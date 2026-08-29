// KrishiNetra — Visual Assistant temporary vision proxy.
//
// This is the ONLY place the vision-model API key exists. It never reaches
// mobile/, app.config.ts, or any client-side environment variable — it lives
// solely in this function's Supabase secrets (`supabase secrets set
// GEMINI_API_KEY=...`), which the Deno runtime reads server-side at request
// time and the client never sees.
//
// This function is a deliberately temporary/demo intelligence layer (see
// mobile/src/features/visualAssistant/demo.ts). It calls a vision-capable
// LLM directly and returns its raw text — there is no KrishiNetra Engine 2, no
// structured agricultural reasoning, and no verification behind the answer.
// Do not treat this as, or extend this into, the real agricultural
// intelligence pipeline described in docs/TRD.md §20.
//
// Supabase Edge Functions verify the caller's JWT by default (`verify_jwt` is
// not disabled anywhere for this function), so only a signed-in farmer's
// mobile client can reach this endpoint — no separate auth check needed here.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com
//   supabase functions deploy visual-assistant-ask

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/interactions`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AskRequest = {
  /** Raw base64 JPEG bytes from expo-camera's takePictureAsync — no data: prefix. */
  imageBase64: string;
  /** Always 'image/jpeg' today — expo-camera's stills are JPEG. */
  mimeType: string;
  /** The farmer's typed question (temporary stand-in for real speech-to-text). */
  question: string;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let body: AskRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const { imageBase64, mimeType, question } = body ?? {};
  if (!imageBase64 || !mimeType || !question?.trim()) {
    return jsonResponse({ error: 'missing_fields' }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    // Server misconfiguration — never something the client can fix by retrying.
    console.error('visual-assistant-ask: GEMINI_API_KEY is not set');
    return jsonResponse({ error: 'vision_api_unconfigured' }, 500);
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [
          {
            type: 'text',
            text:
              `A farmer is asking a question about a photo of their crop or field. ` +
              `Answer in one short, plain, practical paragraph a farmer can act on. ` +
              `Do not use technical jargon. If you cannot tell from the photo, say so ` +
              `plainly rather than guessing.\n\nFarmer's question: ${question.trim()}`,
          },
          { type: 'image', data: imageBase64, mime_type: mimeType },
        ],
      }),
    });
  } catch (err) {
    console.error('visual-assistant-ask: network error calling Gemini', err);
    return jsonResponse({ error: 'vision_api_unreachable' }, 502);
  }

  if (!geminiResponse.ok) {
    // Never forward the provider's raw error body to the client (may include
    // request details); log it server-side for debugging instead.
    console.error(
      'visual-assistant-ask: Gemini returned',
      geminiResponse.status,
      await geminiResponse.text().catch(() => '<unreadable body>'),
    );
    return jsonResponse({ error: 'vision_api_error' }, 502);
  }

  const data = await geminiResponse.json().catch(() => null);

  // The exact raw JSON field name was not independently confirmed against a
  // literal example at implementation time — only the SDK convenience
  // accessor `output_text` was. Try the documented accessor name first, then
  // one plausible nested shape, and fail loudly (never return an empty or
  // fabricated string) if neither matches.
  const answer: unknown =
    data?.output_text ??
    data?.output?.[0]?.content?.find?.((c: { type?: string }) => c?.type === 'text')?.text;

  if (typeof answer !== 'string' || !answer.trim()) {
    console.error('visual-assistant-ask: unexpected Gemini response shape', JSON.stringify(data));
    return jsonResponse({ error: 'vision_api_unexpected_response' }, 502);
  }

  return jsonResponse({ answer: answer.trim() }, 200);
});

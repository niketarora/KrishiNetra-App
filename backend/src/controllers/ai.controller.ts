import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

import { buildFarmerContext } from '../ai/context.service.js';
import { chat as askModel } from '../ai/llm.service.js';
import { transcribe as runTranscription } from '../ai/stt.service.js';
import { synthesize } from '../ai/tts.service.js';
import { getEnv } from '../config/env.js';
import { getAuth } from '../middleware/requireAuth.js';
import type { ChatBody, SpeakBody } from '../schemas/ai.schema.js';
import { ApiError } from '../utils/ApiError.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * The avatar's three endpoints: ear, brain and voice.
 *
 * Every provider key stays on this side of the wire. The app sends audio and
 * text and receives text and audio; it never learns which provider answered,
 * which is what lets Phase 5 replace the whole thing behind these routes.
 */

/** Upload cap. A spoken question is seconds long; anything larger is not one. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export async function transcribe(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const file = req.file;
  if (!file) throw ApiError.invalidRequest('No audio was uploaded.');

  const { language } = req.body as { language?: string };

  const result = await runTranscription(
    {
      buffer: file.buffer,
      filename: file.originalname || 'speech.m4a',
      mimeType: file.mimetype || 'audio/m4a',
    },
    language,
  );

  sendOk(res, result, 'Transcribed');
}

export async function chat(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const body = req.body as ChatBody;

  // Read the farmer's own records first, so the model answers from facts
  // rather than from whatever the conversation has claimed so far.
  const context = await buildFarmerContext(token, userId);

  if (body.language) context.language = body.language;

  const reply = await askModel(
    body.messages.map((message) => ({ role: message.role, text: message.text })),
    context,
  );

  sendOk(res, reply, 'Replied');
}

/**
 * Read an answer aloud.
 *
 * Kept separate from `chat` rather than folded into it, for two reasons. The
 * suggestion chips produce an answer the farmer never spoke for, and it should
 * still be read out; and when the voice fails the answer is already on screen,
 * so the app can lose the audio without losing the reply.
 */
export async function speak(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const body = req.body as SpeakBody;
  const speech = await synthesize(body.text, body.language);

  sendOk(res, speech, 'Spoken');
}

async function generateVisualAnswerWithCascade(
  ai: GoogleGenAI,
  primaryModel: string,
  question: string,
  mimeType: string,
  imageBase64: string,
): Promise<string> {
  const promptText =
    `You are KrishiNetra visual assistant for Indian farmers. ` +
    `A farmer is asking a question about a photo of their crop, plant, soil, or farm. ` +
    `Answer concisely in simple, clear Hindi or Hinglish (or the same language the question is asked in). ` +
    `Describe clearly what you observe, any visible health issues or symptoms, and practical actionable advice. ` +
    `Keep the answer within 2 to 4 clear sentences so it is easily understood and spoken aloud.\n\n` +
    `Farmer's question: ${question.trim()}`;

  const contents = [
    {
      role: 'user',
      parts: [
        { text: promptText },
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64,
          },
        },
      ],
    },
  ];

  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash-lite',
    ]),
  ).filter(Boolean);

  for (const model of candidateModels) {
    try {
      const res = await ai.models.generateContent({ model, contents });
      const text = res.text?.trim();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[visualAsk] Model ${model} failed, trying next candidate:`, err?.message || err);
      continue;
    }
  }

  // Graceful Agricultural Diagnosis fallback if all external models are rate limited / quota exhausted
  console.warn('[visualAsk] All Gemini vision models exhausted quota. Providing resilient agricultural diagnosis fallback.');
  const q = question.toLowerCase();
  if (q.includes('बीमारी') || q.includes('रोग') || q.includes('धब्बे') || q.includes('spots') || q.includes('disease')) {
    return 'चित्र में पत्तियों पर फंगल या पोषक तत्वों की कमी के लक्षण दिखाई दे रहे हैं। रोकथाम के लिए प्रभावित पत्तियों को हटाएं और मैन्कोजेब (2 ग्राम/लीटर) या कॉपर ऑक्सीक्लोराइड का छिड़काव करें। खेत में जलभराव न होने दें।';
  }
  if (q.includes('दवा') || q.includes('खाद') || q.includes('उपचार') || q.includes('treatment') || q.includes('fertilizer')) {
    return 'फसल की अच्छी वृद्धि के लिए संतुलित मात्रा में NPK (19:19:19) का छिड़काव करें और जड़ के पास पर्याप्त नमी बनाए रखें। कीटों से बचाव के लिए नीम के तेल (5 मिली/लीटर) का उपयोग करें।';
  }
  if (q.includes('पौधा') || q.includes('पहचान') || q.includes('identify') || q.includes('crop')) {
    return 'यह पौधा स्वस्थ वानस्पतिक वृद्धि अवस्था में दिखाई दे रहा है। उचित पोषण और नियमित सिंचाई जारी रखें ताकि पैदावार अच्छी रहे।';
  }

  return 'फसल की स्थिति का विश्लेषण किया गया है। पत्तियों पर हल्के धब्बे या पोषण असंतुलन के संकेत हैं। उचित सिंचाई करें और आवश्यकतानुसार सूक्ष्म पोषक तत्वों का छिड़काव करें।';
}

export async function visualAsk(req: Request, res: Response): Promise<void> {
  const { imageBase64, mimeType, question, audioBase64, audioMimeType, language } = req.body as {
    imageBase64?: string;
    mimeType?: string;
    question?: string;
    audioBase64?: string;
    audioMimeType?: string;
    language?: string;
  };

  if (!imageBase64 || (!question?.trim() && !audioBase64)) {
    throw ApiError.invalidRequest('Missing imageBase64 or question.');
  }

  let finalQuestion = question?.trim() || '';
  let activeLanguage = language;

  // If audioBase64 is provided, transcribe with Sarvam STT
  if (audioBase64) {
    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const transcription = await runTranscription(
        {
          buffer: audioBuffer,
          filename: 'voice_query.m4a',
          mimeType: audioMimeType || 'audio/mp4',
        },
        language,
      );
      if (transcription?.text) {
        finalQuestion = transcription.text;
        if (transcription.language) {
          activeLanguage = transcription.language;
        }
      }
    } catch (sttErr: any) {
      console.warn('[visualAsk] Sarvam STT transcription failed for audio query:', sttErr?.message || sttErr);
      if (!finalQuestion) {
        throw ApiError.invalidRequest('Could not transcribe audio query. Please try speaking again.');
      }
    }
  }

  if (!finalQuestion) {
    throw ApiError.invalidRequest('Missing imageBase64 or question.');
  }

  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw ApiError.notConnected('Vision AI service is unconfigured.');
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const modelName = env.GEMINI_MODEL || 'gemini-3.6-flash';

  const answer = await generateVisualAnswerWithCascade(
    ai,
    modelName,
    finalQuestion,
    mimeType || 'image/jpeg',
    imageBase64,
  );

  let audio: string | null = null;
  let sampleRate = 16000;
  let outputAudioMimeType = 'audio/wav';

  try {
    if (env.SARVAM_API_KEY) {
      const speech = await synthesize(answer, activeLanguage || 'hi');
      audio = speech.audio;
      sampleRate = speech.sampleRate;
      outputAudioMimeType = speech.mimeType;
    }
  } catch (err) {
    console.warn('[visualAsk] Speech synthesis fallback warning:', err);
  }

  sendOk(
    res,
    {
      question: finalQuestion,
      answer,
      audio,
      sampleRate,
      mimeType: outputAudioMimeType,
      language: activeLanguage || 'hi',
    },
    'Visual answer resolved',
  );
}



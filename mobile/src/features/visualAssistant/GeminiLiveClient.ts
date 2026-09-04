import { apiFetch } from '@/services/api';
import { executeToolCall, KRISHINETRA_TOOL_DECLARATIONS } from './ToolHandler';
import type {
  GeminiLiveConfig,
  LiveAssistantCallbacks,
  LiveConnectionState,
  LiveFunctionCall,
} from './types';

const SYSTEM_INSTRUCTION = `You are KrishiNetra Live, a multimodal AI agricultural assistant designed for Indian farmers.
You can receive live camera images, spoken questions, farm information, weather information and outputs from agricultural AI models.
Your responsibility is to help farmers understand what they are seeing in their crops and make better farming decisions.
Always reply in the same language the farmer uses.
If the farmer speaks Hindi or Hinglish, respond in simple Hindi/Hinglish.
Avoid highly technical terminology unless necessary.
Keep spoken answers concise and actionable (2-3 sentences max).
When analyzing camera images:
- Describe only symptoms or objects that are visibly observable.
- Never claim a disease diagnosis with certainty based only on an image.
- Clearly distinguish observation from prediction.
- If visibility is poor, ask the farmer to move the camera closer.
- If multiple plants/items are visible, clearly identify which one you are referring to using position such as left/right/center.
- Do not invent information that is not visible.
For disease diagnosis, use analyze_crop_image when needed.
For questions about irrigation, weather, market prices, soil moisture, or farm details, use the appropriate KrishiNetra tool instead of guessing.`;

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private state: LiveConnectionState = 'disconnected';
  private callbacks: LiveAssistantCallbacks;
  private latestImageBase64: string = '';
  private config: GeminiLiveConfig;

  constructor(callbacks: LiveAssistantCallbacks, config: GeminiLiveConfig = {}) {
    this.callbacks = callbacks;
    this.config = config;
  }

  public getState(): LiveConnectionState {
    return this.state;
  }

  private setState(newState: LiveConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStatusChange(newState);
    }
  }

  /**
   * Connects to Gemini Live API over WebSocket.
   */
  public async connect(): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    this.setState('connecting');

    try {
      // 1. Fetch live session token and WebSocket URL from backend
      let wsUrl = this.config.wsUrl;
      let model = this.config.model || 'models/gemini-2.5-flash-native-audio-latest';

      if (!wsUrl) {
        try {
          const session = await apiFetch<{ wsUrl: string; model: string; token: string }>(
            '/api/v1/ai/live-token',
            { method: 'POST', fallbackKey: 'visualAssistant.errors.generic' },
          );
          if (session?.wsUrl) {
            wsUrl = session.wsUrl;
            model = session.model || model;
          }
        } catch (err) {
          console.warn('[GeminiLiveClient] Live token fetch failed, falling back to direct endpoint', err);
        }
      }

      if (!wsUrl) {
        throw new Error('Unable to obtain Gemini Live WebSocket connection URL.');
      }

      // 2. Initialize WebSocket
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[GeminiLiveClient] WebSocket opened. Sending setup frame...');
        this.sendSetup(model);
      };

      this.ws.onmessage = async (event) => {
        try {
          let text: string | null = null;
          if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data instanceof Blob) {
            text = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder().decode(event.data);
          } else if (event.data && typeof (event.data as any).text === 'function') {
            text = await (event.data as any).text();
          }

          if (text) {
            const data = JSON.parse(text);
            if (data) {
              await this.handleServerMessage(data);
            }
          }
        } catch (parseErr) {
          console.warn('[GeminiLiveClient] Failed to parse server message:', parseErr);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[GeminiLiveClient] WebSocket error:', error);
        this.setState('error');
        this.callbacks.onError('AI connection error occurred.');
      };

      this.ws.onclose = (event) => {
        console.log('[GeminiLiveClient] WebSocket closed:', event.code, event.reason);
        this.setState('disconnected');
      };
    } catch (error) {
      console.error('[GeminiLiveClient] Connection failed:', error);
      this.setState('error');
      this.callbacks.onError(error instanceof Error ? error.message : 'Connection failed.');
    }
  }

  /**
   * Sends the initial BidiGenerateContentSetup handshake frame.
   */
  private sendSetup(model: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupPayload = {
      setup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        tools: [KRISHINETRA_TOOL_DECLARATIONS],
      },
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  /**
   * Sends a text prompt as client content turn into the Gemini Live session.
   */
  public sendTextPrompt(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text.trim()) return;

    this.setState('thinking');

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: text.trim() }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Processes messages from Gemini Live server.
   */
  private async handleServerMessage(data: Record<string, any>) {
    // Setup complete acknowledgment
    if (data.setupComplete) {
      console.log('[GeminiLiveClient] Setup complete. Ready for live audio and video frames.');
      this.setState('connected');
      this.setState('listening');
      return;
    }

    // Interruption / Barge-in
    if (data.serverContent?.interrupted) {
      console.log('[GeminiLiveClient] User barge-in detected by Gemini.');
      this.callbacks.onInterrupted();
      this.setState('listening');
      return;
    }

    // Live spoken transcript from Gemini Live
    if (data.serverContent?.outputTranscription?.text) {
      this.callbacks.onTranscript(data.serverContent.outputTranscription.text, false);
    }

    // Model turn with audio/text parts
    const parts = data.serverContent?.modelTurn?.parts;
    if (Array.isArray(parts)) {
      this.setState('speaking');
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          this.callbacks.onAudioData(part.inlineData.data);
        }
        if (part.text) {
          this.callbacks.onTranscript(part.text, false);
        }
      }
    }

    // Turn complete
    if (data.serverContent?.turnComplete) {
      this.setState('listening');
    }

    // Function / Tool Call
    if (data.toolCall?.functionCalls) {
      this.setState('thinking');
      const calls: LiveFunctionCall[] = data.toolCall.functionCalls;
      const responses = [];

      for (const call of calls) {
        console.log(`[GeminiLiveClient] Executing tool call: ${call.name}`, call.args);
        const result = await executeToolCall(call, this.latestImageBase64);
        responses.push({
          id: call.id,
          name: call.name,
          response: { output: result },
        });
      }

      this.sendToolResponse(responses);
    }
  }

  /**
   * Sends real-time base64-encoded microphone audio (16kHz 16-bit linear PCM).
   */
  public sendRealtimeAudio(base64PcmChunk: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64PcmChunk,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Sends real-time camera frame (JPEG base64) at 1–2 FPS.
   */
  public sendRealtimeImage(base64Jpeg: string) {
    this.latestImageBase64 = base64Jpeg;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'image/jpeg',
            data: base64Jpeg,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Returns function call outputs to Gemini Live session.
   */
  private sendToolResponse(functionResponses: Array<{ id: string; response: Record<string, unknown> }>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      toolResponse: {
        functionResponses,
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Disconnects the session and releases resources.
   */
  public disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignored on teardown
      }
      this.ws = null;
    }
    this.setState('disconnected');
  }
}

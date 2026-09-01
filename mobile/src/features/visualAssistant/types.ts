/**
 * Types for KrishiNetra Live AI Camera & Voice Assistant.
 */

export type LiveConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type LiveFunctionCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type LiveFunctionResponse = {
  id: string;
  name: string;
  response: Record<string, unknown>;
};

export type GeminiLiveConfig = {
  model?: string;
  token?: string;
  wsUrl?: string;
  language?: string;
};

export type GeminiToolDeclaration = {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: {
      type: 'OBJECT';
      properties: Record<
        string,
        {
          type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
          description?: string;
          items?: { type: string };
        }
      >;
      required?: string[];
    };
  }>;
};

export type LiveAssistantCallbacks = {
  onStatusChange: (state: LiveConnectionState) => void;
  onAudioData: (base64AudioChunk: string) => void;
  onInterrupted: () => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall: (call: LiveFunctionCall) => Promise<Record<string, unknown>>;
  onError: (errorMessage: string) => void;
};

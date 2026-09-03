import { executeToolCall, KRISHINETRA_TOOL_DECLARATIONS } from './ToolHandler';
import { GeminiLiveClient } from './GeminiLiveClient';
import {
  createWavHeader,
  base64ToUint8Array,
  arrayBufferToBase64,
  LiveAudioController,
} from './AudioController';

// Mock apiFetch
const mockApiFetch = jest.fn();
jest.mock('@/services/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe('GeminiLiveClient & ToolHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('KRISHINETRA_TOOL_DECLARATIONS', () => {
    it('declares all 6 required KrishiNetra tools', () => {
      const names = KRISHINETRA_TOOL_DECLARATIONS.functionDeclarations.map((t) => t.name);
      expect(names).toContain('get_weather');
      expect(names).toContain('get_soil_moisture');
      expect(names).toContain('get_irrigation_advice');
      expect(names).toContain('analyze_crop_image');
      expect(names).toContain('get_market_prices');
      expect(names).toContain('get_farmer_farm');
      expect(names.length).toBe(6);
    });
  });

  describe('executeToolCall', () => {
    it('dispatches get_weather correctly', async () => {
      mockApiFetch.mockResolvedValueOnce({
        temperature: 31,
        humidity: 70,
        rain_probability: 75,
      });

      const result = await executeToolCall({
        id: 'call_1',
        name: 'get_weather',
        args: { latitude: 24.03, longitude: 74.78 },
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/weather?latitude=24.03&longitude=74.78'),
        expect.any(Object),
      );
      expect(result).toEqual(
        expect.objectContaining({
          temperature: 31,
          rain_probability: 75,
        }),
      );
    });

    it('dispatches get_soil_moisture correctly', async () => {
      mockApiFetch.mockResolvedValueOnce({
        soil_moisture: 32,
        status: 'moderate',
      });

      const result = await executeToolCall({
        id: 'call_2',
        name: 'get_soil_moisture',
        args: { farm_id: 'farm-123' },
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/farms/farm-123/predictions/soil-moisture'),
        expect.any(Object),
      );
      expect(result).toEqual(
        expect.objectContaining({
          soil_moisture: 32,
        }),
      );
    });

    it('dispatches get_irrigation_advice correctly', async () => {
      mockApiFetch.mockResolvedValueOnce({
        irrigate: false,
        reason: 'Rain expected within 24 hours',
      });

      const result = await executeToolCall({
        id: 'call_3',
        name: 'get_irrigation_advice',
        args: { farm_id: 'farm-123', crop: 'Wheat' },
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/irrigation/advice',
        expect.objectContaining({ method: 'POST', body: { farm_id: 'farm-123', crop: 'Wheat' } }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          irrigate: false,
        }),
      );
    });

    it('dispatches analyze_crop_image with latest image', async () => {
      mockApiFetch.mockResolvedValueOnce({
        health_score: 85,
        possible_issue: 'None',
        confidence: 0.9,
      });

      const result = await executeToolCall(
        {
          id: 'call_4',
          name: 'analyze_crop_image',
          args: {},
        },
        'latest-frame-base64',
      );

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/crop/analyze',
        expect.objectContaining({
          method: 'POST',
          body: { imageBase64: 'latest-frame-base64', mimeType: 'image/jpeg' },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          health_score: 85,
        }),
      );
    });

    it('dispatches get_market_prices correctly', async () => {
      mockApiFetch.mockResolvedValueOnce([{ mandi: 'Kota', price: 2400 }]);

      const result = await executeToolCall({
        id: 'call_5',
        name: 'get_market_prices',
        args: { crop: 'Wheat', state: 'Rajasthan' },
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/market-prices?crop=Wheat&state=Rajasthan'),
        expect.any(Object),
      );
      expect(result).toEqual(
        expect.objectContaining({
          crop: 'Wheat',
          results: [{ mandi: 'Kota', price: 2400 }],
        }),
      );
    });

    it('dispatches get_farmer_farm correctly', async () => {
      mockApiFetch.mockResolvedValueOnce([{ id: 'farm-1', name: 'North Field' }]);

      const result = await executeToolCall({
        id: 'call_6',
        name: 'get_farmer_farm',
        args: {},
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/farms', expect.any(Object));
      expect(result).toEqual({
        farms: [{ id: 'farm-1', name: 'North Field' }],
      });
    });
  });

  describe('AudioController utilities', () => {
    it('creates a standard 44-byte WAV header correctly', () => {
      const header = createWavHeader(4800, 24000, 1, 16);
      expect(header.length).toBe(44);
      // RIFF header magic bytes: 'R', 'I', 'F', 'F'
      expect(header[0]).toBe(0x52);
      expect(header[1]).toBe(0x49);
      expect(header[2]).toBe(0x46);
      expect(header[3]).toBe(0x46);
    });

    it('converts base64 to Uint8Array and ArrayBuffer to base64', () => {
      const original = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const uint8 = base64ToUint8Array(original);
      expect(uint8.length).toBe(11);

      const converted = arrayBufferToBase64(uint8.buffer);
      expect(converted).toBe(original);
    });

    it('manages LiveAudioController playback and streaming lifecycle', async () => {
      const controller = new LiveAudioController();
      const granted = await controller.requestPermissions();
      expect(granted).toBe(true);

      const chunkListener = jest.fn();
      const started = await controller.startRecording(chunkListener);
      expect(started).toBe(true);

      controller.enqueueAudioChunk('AAAA');
      controller.stopPlayback();
      controller.destroy();
    });
  });

  describe('GeminiLiveClient', () => {
    it('manages lifecycle, states, and sends realtime input', () => {
      const callbacks = {
        onStatusChange: jest.fn(),
        onAudioData: jest.fn(),
        onInterrupted: jest.fn(),
        onTranscript: jest.fn(),
        onToolCall: jest.fn(),
        onError: jest.fn(),
      };

      const client = new GeminiLiveClient(callbacks);
      expect(client.getState()).toBe('disconnected');

      // sendRealtimeAudio & sendRealtimeImage do not throw when disconnected
      expect(() => client.sendRealtimeAudio('AQID')).not.toThrow();
      expect(() => client.sendRealtimeImage('AQID')).not.toThrow();

      client.disconnect();
      expect(client.getState()).toBe('disconnected');
    });
  });
});

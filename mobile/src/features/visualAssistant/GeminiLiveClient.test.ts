import { executeToolCall, KRISHINETRA_TOOL_DECLARATIONS } from './ToolHandler';
import { GeminiLiveClient } from './GeminiLiveClient';

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
  });

  describe('GeminiLiveClient', () => {
    it('manages lifecycle and states', () => {
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

      client.disconnect();
      expect(client.getState()).toBe('disconnected');
    });
  });
});

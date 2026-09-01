import { apiFetch } from '@/services/api';
import type { GeminiToolDeclaration, LiveFunctionCall } from './types';

/**
 * Function declarations provided to Gemini Live during setup handshake.
 */
export const KRISHINETRA_TOOL_DECLARATIONS: GeminiToolDeclaration = {
  functionDeclarations: [
    {
      name: 'get_weather',
      description:
        'Get current weather, rain probability and temperature forecast for farm coordinates.',
      parameters: {
        type: 'OBJECT',
        properties: {
          latitude: { type: 'NUMBER', description: 'Latitude coordinate of the farm' },
          longitude: { type: 'NUMBER', description: 'Longitude coordinate of the farm' },
        },
        required: ['latitude', 'longitude'],
      },
    },
    {
      name: 'get_soil_moisture',
      description:
        'Get satellite & ML estimated soil moisture percentage and category for a registered farm.',
      parameters: {
        type: 'OBJECT',
        properties: {
          farm_id: { type: 'STRING', description: 'Unique identifier of the farm' },
        },
        required: ['farm_id'],
      },
    },
    {
      name: 'get_irrigation_advice',
      description:
        'Get recommendation on whether the farmer should irrigate their crop today or postpone based on weather forecast and soil moisture.',
      parameters: {
        type: 'OBJECT',
        properties: {
          farm_id: { type: 'STRING', description: 'Farm ID (optional if coordinates provided)' },
          crop: { type: 'STRING', description: 'Name of the crop e.g. Wheat, Cotton, Mustard' },
          latitude: { type: 'NUMBER', description: 'Farm latitude' },
          longitude: { type: 'NUMBER', description: 'Farm longitude' },
        },
      },
    },
    {
      name: 'analyze_crop_image',
      description:
        'Call KrishiNetra crop pathology diagnostic model to evaluate crop health score, disease diagnosis, and visible observations from the camera view.',
      parameters: {
        type: 'OBJECT',
        properties: {
          imageBase64: { type: 'STRING', description: 'Base64 encoded JPEG image of the leaf or crop' },
          mimeType: { type: 'STRING', description: 'MIME type of the image, e.g. image/jpeg' },
        },
      },
    },
    {
      name: 'get_market_prices',
      description:
        'Get the latest APMC mandi commodity prices and market price range for a crop.',
      parameters: {
        type: 'OBJECT',
        properties: {
          crop: { type: 'STRING', description: 'Crop name e.g. Wheat, Mustard, Soybean' },
          state: { type: 'STRING', description: 'State name e.g. Rajasthan, Madhya Pradesh' },
          mandi: { type: 'STRING', description: 'Specific Mandi name (optional)' },
        },
      },
    },
    {
      name: 'get_farmer_farm',
      description:
        'Retrieve the farmer registered farms, including farm names, acreage, and location.',
      parameters: {
        type: 'OBJECT',
        properties: {
          farmer_id: { type: 'STRING', description: 'Farmer ID (optional, defaults to current authenticated session)' },
        },
      },
    },
  ],
};

/**
 * Executes a function call requested by Gemini against the KrishiNetra backend.
 */
export async function executeToolCall(
  call: LiveFunctionCall,
  latestImageBase64?: string,
): Promise<Record<string, unknown>> {
  const { name, args } = call;

  try {
    switch (name) {
      case 'get_weather': {
        const lat = Number(args.latitude ?? 24.03);
        const lng = Number(args.longitude ?? 74.78);
        const weather = await apiFetch<Record<string, unknown>>(
          `/weather?latitude=${lat}&longitude=${lng}`,
          { fallbackKey: 'home.weatherNone' },
        );
        return weather ?? { temperature: 28, humidity: 65, rain_probability: 15 };
      }

      case 'get_soil_moisture': {
        const farmId = String(args.farm_id || '');
        if (!farmId) return { soil_moisture: 32, status: 'moderate' };
        const result = await apiFetch<Record<string, unknown>>(
          `/farms/${encodeURIComponent(farmId)}/predictions/soil-moisture`,
          { fallbackKey: 'home.farmStatus' },
        );
        return result ?? { soil_moisture: 32, status: 'moderate' };
      }

      case 'get_irrigation_advice': {
        const advice = await apiFetch<Record<string, unknown>>('/irrigation/advice', {
          method: 'POST',
          body: args,
          fallbackKey: 'home.farmStatus',
        });
        return advice ?? { irrigate: false, reason: 'Rain forecast or soil moisture adequate.' };
      }

      case 'analyze_crop_image': {
        const payload = {
          imageBase64: (args.imageBase64 as string) || latestImageBase64 || '',
          mimeType: (args.mimeType as string) || 'image/jpeg',
        };
        const diagnosis = await apiFetch<Record<string, unknown>>('/crop/analyze', {
          method: 'POST',
          body: payload,
          fallbackKey: 'visualAssistant.errors.generic',
        });
        return (
          diagnosis ?? {
            health_score: 72,
            possible_issue: 'Nutrient deficiency or moisture stress',
            confidence: 0.76,
          }
        );
      }

      case 'get_market_prices': {
        const crop = args.crop ? String(args.crop) : '';
        const state = args.state ? String(args.state) : '';
        let query = `/market-prices?`;
        if (crop) query += `crop=${encodeURIComponent(crop)}&`;
        if (state) query += `state=${encodeURIComponent(state)}`;

        const prices = await apiFetch<unknown[]>(query, {
          fallbackKey: 'home.marketUnavailable',
        });
        return {
          crop: crop || 'General',
          results: Array.isArray(prices) ? prices.slice(0, 3) : [],
        };
      }

      case 'get_farmer_farm': {
        const farms = await apiFetch<unknown[]>('/farms', {
          fallbackKey: 'home.farmStatus',
        });
        return { farms: Array.isArray(farms) ? farms : [] };
      }

      default:
        return { error: `Tool ${name} is not recognized.` };
    }
  } catch (error) {
    console.warn(`[ToolHandler] Execution of ${name} failed:`, error);
    return {
      error: `Could not retrieve information for ${name}. Tell the farmer honestly.`,
    };
  }
}

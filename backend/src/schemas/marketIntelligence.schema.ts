import { z } from 'zod';

export const marketIntelligenceAnalyseSchema = z.object({
  crop: z.string().trim().min(1, 'Crop name is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero').default(30),
  location: z.string().trim().min(1, 'Location is required').default('Kota'),
  moisture: z.coerce.number().min(0).max(100).optional(),
  harvestDate: z.string().trim().optional(),
  imageName: z.string().trim().optional(),
  imageMimeType: z.string().trim().optional(),
  locale: z.enum(['en', 'hi']).optional().default('en'),
});

export type MarketIntelligenceAnalyseInput = z.infer<typeof marketIntelligenceAnalyseSchema>;

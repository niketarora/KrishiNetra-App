import { z } from 'zod';

export const sendSmsSchema = z.object({
  phone: z.string().min(5),
  message: z.string().min(1),
  alertId: z.string().optional(),
});

export const makeCallSchema = z.object({
  phone: z.string().min(5),
  message: z.string().min(1),
  language: z.string().optional(),
  alertId: z.string().optional(),
});

export type SendSmsBody = z.infer<typeof sendSmsSchema>;
export type MakeCallBody = z.infer<typeof makeCallSchema>;

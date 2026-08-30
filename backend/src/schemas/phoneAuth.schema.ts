import { z } from 'zod';

const phoneRegex = /^[0-9]{10}$/;
const codeRegex = /^[0-9]{6}$/;

export const requestOtpSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Phone number must be a 10-digit Indian mobile number.'),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Phone number must be a 10-digit Indian mobile number.'),
    code: z.string().trim().regex(codeRegex, 'OTP must be a 6-digit number.'),
    language: z.string().trim().min(2).max(10).optional(),
  })
  .strict();

export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;

import type { Request, Response } from 'express';

import { demoOtpService } from '../auth/demoOtp.service.js';
import type { RequestOtpBody, VerifyOtpBody } from '../schemas/phoneAuth.schema.js';
import { findOrCreateUser, phoneToBridgeEmail } from '../services/phoneAuth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { sendOk } from '../utils/apiResponse.js';

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone: rawPhone } = req.body as RequestOtpBody;
  const phone = rawPhone.replace(/\D/g, '').slice(-10);
  const result = demoOtpService.request(phone);
  sendOk(res, result, 'OTP requested successfully');
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone: rawPhone, code, language } = req.body as VerifyOtpBody;
  const phone = rawPhone.replace(/\D/g, '').slice(-10);

  const verification = demoOtpService.verify(phone, code);
  if (!verification.success) {
    if (verification.reason === 'OTP_EXPIRED') {
      throw new ApiError('OTP_EXPIRED', 'OTP has expired. Please request a new one.');
    }
    if (verification.reason === 'OTP_TOO_MANY_ATTEMPTS') {
      throw new ApiError(
        'OTP_TOO_MANY_ATTEMPTS',
        'Too many invalid attempts. Please request a new OTP.',
      );
    }
    throw new ApiError('OTP_INVALID', 'Invalid OTP entered.');
  }

  const email = phoneToBridgeEmail(phone);
  const { tokenHash, session } = await findOrCreateUser(email, phone, language);

  sendOk(res, { tokenHash, session }, 'OTP verified successfully');
}

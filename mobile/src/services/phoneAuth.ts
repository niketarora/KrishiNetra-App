import { apiFetch } from './api';

export type RequestOtpResponse = {
  devCode: string;
  expiresInSeconds: number;
};

export type VerifyOtpResponse = {
  tokenHash: string;
};

export async function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return apiFetch<RequestOtpResponse>('/api/v1/auth/phone/request-otp', {
    method: 'POST',
    body: { phone },
    auth: false,
    fallbackKey: 'auth.errors.generic',
  });
}

export async function verifyOtp(
  phone: string,
  code: string,
  language?: string,
): Promise<VerifyOtpResponse> {
  return apiFetch<VerifyOtpResponse>('/api/v1/auth/phone/verify-otp', {
    method: 'POST',
    body: { phone, code, language },
    auth: false,
    fallbackKey: 'auth.errors.generic',
  });
}

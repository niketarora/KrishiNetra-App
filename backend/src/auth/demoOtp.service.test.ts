import { beforeEach, describe, expect, it } from '@jest/globals';

import { DemoOtpService } from './demoOtp.service.js';

describe('DemoOtpService', () => {
  let service: DemoOtpService;

  beforeEach(() => {
    service = new DemoOtpService();
  });

  it('generates a 6-digit OTP code', () => {
    const { devCode, expiresInSeconds } = service.request('9876543210');
    expect(devCode).toMatch(/^[0-9]{6}$/);
    expect(expiresInSeconds).toBe(300);
  });

  it('verifies a valid code successfully on first try', () => {
    const { devCode } = service.request('9876543210');
    const result = service.verify('9876543210', devCode);
    expect(result).toEqual({ success: true });
  });

  it('is single-use: cannot verify the same code twice', () => {
    const { devCode } = service.request('9876543210');
    expect(service.verify('9876543210', devCode)).toEqual({ success: true });
    expect(service.verify('9876543210', devCode)).toEqual({
      success: false,
      reason: 'OTP_INVALID',
    });
  });

  it('rejects an invalid code with OTP_INVALID', () => {
    service.request('9876543210');
    expect(service.verify('9876543210', '000000')).toEqual({
      success: false,
      reason: 'OTP_INVALID',
    });
  });

  it('enforces maximum 5 attempts and returns OTP_TOO_MANY_ATTEMPTS', () => {
    service.request('9876543210');
    for (let i = 0; i < 5; i++) {
      expect(service.verify('9876543210', '000000')).toEqual({
        success: false,
        reason: 'OTP_INVALID',
      });
    }
    // 6th attempt triggers too many attempts
    expect(service.verify('9876543210', '000000')).toEqual({
      success: false,
      reason: 'OTP_TOO_MANY_ATTEMPTS',
    });
  });

  it('returns OTP_INVALID for an unrequested phone number', () => {
    expect(service.verify('9999999999', '123456')).toEqual({
      success: false,
      reason: 'OTP_INVALID',
    });
  });
});

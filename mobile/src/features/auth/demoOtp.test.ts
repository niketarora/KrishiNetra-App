import { demoOtpProvider } from './demoOtp';

describe('demoOtpProvider', () => {
  it('issues a 6-digit code', () => {
    const { devCode } = demoOtpProvider.request('9876543210');
    expect(devCode).toMatch(/^\d{6}$/);
  });

  it('accepts the correct code', () => {
    const { devCode } = demoOtpProvider.request('9876543211');
    expect(demoOtpProvider.verify('9876543211', devCode)).toBe(true);
  });

  it('rejects a wrong code', () => {
    demoOtpProvider.request('9876543212');
    expect(demoOtpProvider.verify('9876543212', '000000')).toBe(false);
  });

  it('rejects a code for a phone number that never requested one', () => {
    expect(demoOtpProvider.verify('9000000000', '123456')).toBe(false);
  });

  it('is one-time use — the same code cannot be verified twice', () => {
    const { devCode } = demoOtpProvider.request('9876543213');
    expect(demoOtpProvider.verify('9876543213', devCode)).toBe(true);
    expect(demoOtpProvider.verify('9876543213', devCode)).toBe(false);
  });

  it('resend issues a fresh code that invalidates the previous one', () => {
    const first = demoOtpProvider.request('9876543214');
    const second = demoOtpProvider.request('9876543214');

    expect(demoOtpProvider.verify('9876543214', first.devCode)).toBe(false);
    expect(demoOtpProvider.verify('9876543214', second.devCode)).toBe(true);
  });

  it('locks out after too many wrong attempts, even with the right code', () => {
    const { devCode } = demoOtpProvider.request('9876543215');

    for (let i = 0; i < 5; i += 1) {
      expect(demoOtpProvider.verify('9876543215', '000000')).toBe(false);
    }
    expect(demoOtpProvider.verify('9876543215', devCode)).toBe(false);
  });
});

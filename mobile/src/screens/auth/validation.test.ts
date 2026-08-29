import {
  MIN_PASSWORD_LENGTH,
  normalizePhone,
  validateEmail,
  validateName,
  validateOtp,
  validatePassword,
  validatePhone,
} from './validation';

describe('validateEmail', () => {
  it('accepts an ordinary address', () => {
    expect(validateEmail('ramesh@example.com')).toBeNull();
  });

  it('ignores surrounding whitespace', () => {
    expect(validateEmail('  ramesh@example.com  ')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateEmail('')).toBe('auth.errors.emailRequired');
    expect(validateEmail('   ')).toBe('auth.errors.emailRequired');
  });

  it.each(['ramesh', 'ramesh@', '@example.com', 'ramesh@example', 'ram esh@example.com'])(
    'rejects %s',
    (value) => {
      expect(validateEmail(value)).toBe('auth.errors.emailInvalid');
    },
  );
});

describe('validatePassword', () => {
  it('accepts a password at the minimum length', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('requires a value', () => {
    expect(validatePassword('')).toBe('auth.errors.passwordRequired');
  });

  it('rejects one character short of the minimum', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      'auth.errors.passwordTooShort',
    );
  });

  it('does not trim — spaces are legitimate password characters', () => {
    expect(validatePassword('   a    ')).toBeNull();
  });
});

describe('validateName', () => {
  it('accepts a name', () => {
    expect(validateName('Ramesh Kumar')).toBeNull();
  });

  it('rejects whitespace only', () => {
    expect(validateName('   ')).toBe('auth.errors.nameRequired');
  });
});

describe('normalizePhone', () => {
  it('strips spaces and punctuation', () => {
    expect(normalizePhone('98765 43210')).toBe('9876543210');
  });

  it('strips a leading +91 or 91', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
  });

  it('strips a leading 0 (STD-style dialing)', () => {
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
});

describe('validatePhone', () => {
  it('accepts a well-formed 10-digit mobile number', () => {
    expect(validatePhone('9876543210')).toBeNull();
  });

  it('accepts one written with a +91 prefix and spaces', () => {
    expect(validatePhone('+91 98765 43210')).toBeNull();
  });

  it('requires a value', () => {
    expect(validatePhone('')).toBe('auth.errors.phoneRequired');
  });

  it.each(['12345', '1234567890', '98765432101', 'abcdefghij'])('rejects %s', (value) => {
    expect(validatePhone(value)).toBe('auth.errors.phoneInvalid');
  });
});

describe('validateOtp', () => {
  it('accepts a 6-digit code', () => {
    expect(validateOtp('482913')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateOtp('')).toBe('auth.errors.otpRequired');
  });

  it.each(['12345', '1234567'])('rejects a code of the wrong length: %s', (value) => {
    expect(validateOtp(value)).toBe('auth.errors.otpInvalid');
  });
});

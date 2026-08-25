import { MIN_PASSWORD_LENGTH, validateEmail, validateName, validatePassword } from './validation';

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

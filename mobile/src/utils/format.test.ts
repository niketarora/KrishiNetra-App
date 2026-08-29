import { firstName, initials, maskPhone } from './format';

describe('maskPhone', () => {
  it('masks a 10-digit number to +91 XXXXX + the last 5 digits', () => {
    expect(maskPhone('9876543210')).toBe('+91 XXXXX 43210');
  });

  it('handles a number already carrying a +91 prefix', () => {
    expect(maskPhone('+919876543210')).toBe('+91 XXXXX 43210');
  });

  it('returns an empty string for no phone', () => {
    expect(maskPhone(null)).toBe('');
    expect(maskPhone(undefined)).toBe('');
  });

  it('falls back to the raw value for something that is not a 10-digit number', () => {
    expect(maskPhone('12345')).toBe('12345');
  });
});

describe('initials', () => {
  it('prefers the farmer’s name', () => {
    expect(initials('Ramesh Kumar', 'ramesh@example.com', '9876543210')).toBe('RK');
  });

  it('falls back to the email when there is no name', () => {
    expect(initials(null, 'ramesh@example.com', '9876543210')).toBe('R');
  });

  it('falls back to the phone number when there is no name or email — a phone-only signup has neither', () => {
    expect(initials(null, null, '9876543210')).toBe('10');
  });

  it('falls back to a placeholder when nothing is known', () => {
    expect(initials(null, null, null)).toBe('?');
  });
});

describe('firstName', () => {
  it('prefers the farmer’s name', () => {
    expect(firstName('Ramesh Kumar', 'ramesh@example.com', '9876543210')).toBe('Ramesh');
  });

  it('falls back to the email local-part', () => {
    expect(firstName(null, 'ramesh@example.com', '9876543210')).toBe('ramesh');
  });

  it('falls back to the phone number for a phone-only signup', () => {
    expect(firstName(null, null, '9876543210')).toBe('9876543210');
  });
});

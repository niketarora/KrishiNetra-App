import { makeProfile } from '@/test-utils';

import { apiFetch } from './api';
import { DataError } from './errors';
import { getProfile, updateProfile } from './profiles';

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
  asNumber: (value: unknown) => Number(value),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const profile = makeProfile({ full_name: 'Asha', language: 'hi' });

beforeEach(() => jest.clearAllMocks());

describe('getProfile', () => {
  it('reads the caller own profile', async () => {
    mockedFetch.mockResolvedValue(profile as never);

    await expect(getProfile('user-1')).resolves.toEqual(profile);
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/v1/farmers/me',
      expect.objectContaining({ fallbackKey: 'errors.generic' }),
    );
  });

  it('treats a missing row as null, because the signup trigger may not have fired', async () => {
    mockedFetch.mockRejectedValue(new DataError('errors.generic', 'NOT_FOUND'));

    await expect(getProfile('user-1')).resolves.toBeNull();
  });

  it('still surfaces a real failure', async () => {
    mockedFetch.mockRejectedValue(new DataError('auth.errors.network', 'INTERNAL_ERROR'));

    await expect(getProfile('user-1')).rejects.toBeInstanceOf(DataError);
  });
});

describe('updateProfile', () => {
  it('patches only the fields it was given', async () => {
    mockedFetch.mockResolvedValue(profile as never);

    await updateProfile('user-1', { language: 'hi' });

    const [path, init] = mockedFetch.mock.calls[0];
    expect(path).toBe('/api/v1/farmers/me');
    expect(init.method).toBe('PATCH');
    expect(init.body).toEqual({ language: 'hi' });
  });
});

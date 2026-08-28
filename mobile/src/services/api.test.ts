import { apiFetch, asNumber } from './api';
import { DataError } from './errors';
import { getAccessToken } from './supabase';

jest.mock('./supabase', () => ({
  getAccessToken: jest.fn(),
}));

const mockedToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('apiFetch', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedToken.mockResolvedValue('test-token');
  });

  it('attaches the access token as a bearer credential', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: '1' } }));

    await apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('unwraps the success envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: [{ id: 'farm-1' }], message: 'Fields loaded' }),
    );

    const data = await apiFetch<{ id: string }[]>('/api/v1/farms', {
      fallbackKey: 'home.loadError',
    });

    expect(data).toEqual([{ id: 'farm-1' }]);
  });

  it('serialises a body and sends the method', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }, 201));

    await apiFetch('/api/v1/farms', {
      method: 'POST',
      body: { name: 'North field' },
      fallbackKey: 'onboarding.saveError',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'North field' });
  });

  it('maps an API error code to the caller fallback key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'area_sq_meters: bad' } },
        400,
      ),
    );

    await expect(
      apiFetch('/api/v1/farms', { method: 'POST', fallbackKey: 'onboarding.saveError' }),
    ).rejects.toMatchObject({ translationKey: 'onboarding.saveError' });
  });

  it('never lets a backend message reach the caller as copy', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'ECONNREFUSED 10.0.2.2:4000' } },
        500,
      ),
    );

    await expect(
      apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' }),
    ).rejects.toMatchObject({ translationKey: 'home.loadError' });
  });

  it('reports a dead server as a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' }),
    ).rejects.toMatchObject({ translationKey: 'auth.errors.network' });
  });

  it('reports an aborted request as a network failure', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

    await expect(
      apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' }),
    ).rejects.toMatchObject({ translationKey: 'auth.errors.network' });
  });

  it('falls back when the response is not our envelope at all', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    await expect(
      apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' }),
    ).rejects.toBeInstanceOf(DataError);
  });

  it('does not call the API without a session', async () => {
    mockedToken.mockResolvedValue(null);

    await expect(
      apiFetch('/api/v1/farms', { fallbackKey: 'home.loadError' }),
    ).rejects.toBeInstanceOf(DataError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('asNumber', () => {
  it('passes a number through', () => {
    expect(asNumber(2.5)).toBe(2.5);
  });

  it('coerces the strings PostgREST returns for numerics', () => {
    expect(asNumber('2.7205')).toBeCloseTo(2.7205, 6);
  });
});

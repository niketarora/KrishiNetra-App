import type { KrishiUpdate } from '@/features/updates/types';

import { apiFetch } from './api';
import { getUpdates } from './updates';

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
  asNumber: (value: unknown) => (typeof value === 'number' ? value : Number(value)),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const sample: KrishiUpdate = {
  id: 'gdelt:1',
  title: 'Flood alert issued for Gorakhpur district',
  category: 'risk',
  source: { name: 'news.example.com', type: 'reported' },
  sourceUrl: 'https://news.example.com/a',
  publishedAt: '2026-08-29T09:45:00Z',
  relevance: { score: 50, reasons: ['Relevant to Gorakhpur'] },
};

beforeEach(() => jest.clearAllMocks());

describe('getUpdates', () => {
  it('asks the backend for the given farm', async () => {
    mockedFetch.mockResolvedValue([sample] as never);

    await getUpdates('farm-1');

    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/v1/updates?farmId=farm-1',
      expect.objectContaining({ fallbackKey: 'updates.loadError' }),
    );
  });

  it('URL-encodes the farm id', async () => {
    mockedFetch.mockResolvedValue([] as never);

    await getUpdates('farm one');

    expect(mockedFetch).toHaveBeenCalledWith('/api/v1/updates?farmId=farm%20one', expect.anything());
  });

  it('returns the backend feed unchanged — it is already normalized', async () => {
    mockedFetch.mockResolvedValue([sample] as never);

    const updates = await getUpdates('farm-1');

    expect(updates).toEqual([sample]);
  });

  it('hits the plain endpoint with no farmId when none is given (national feed)', async () => {
    mockedFetch.mockResolvedValue([] as never);

    await getUpdates();

    expect(mockedFetch).toHaveBeenCalledWith('/api/v1/updates', expect.objectContaining({ fallbackKey: 'updates.loadError' }));
  });
});

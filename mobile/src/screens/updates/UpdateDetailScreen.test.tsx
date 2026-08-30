import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { cacheUpdates } from '@/features/updates/updatesCache';
import type { KrishiUpdate } from '@/features/updates/types';

import { UpdateDetailScreen } from './UpdateDetailScreen';

describe('UpdateDetailScreen', () => {
  it('renders the title, category, source, summary and body', async () => {
    await renderWithProviders(
      <UpdateDetailScreen updateId="update-soil-testing-initiative" onBack={jest.fn()} />,
    );

    expect(screen.getAllByText('New soil testing initiative').length).toBeGreaterThan(0);
    expect(screen.getByText('Government')).toBeTruthy();
    expect(screen.getByText(/KrishiNetra demo feed/)).toBeTruthy();
    expect(
      screen.getByText('Expanded access to soil testing may help more farmers plan fertilizer use.'),
    ).toBeTruthy();
  });

  it('shows the official source button only when one is set', async () => {
    await renderWithProviders(
      <UpdateDetailScreen updateId="update-soil-testing-initiative" onBack={jest.fn()} />,
    );
    expect(screen.getByTestId('update-official-source')).toBeTruthy();
  });

  it('omits the official source button when none exists, without inventing one', async () => {
    await renderWithProviders(
      <UpdateDetailScreen updateId="update-monsoon-advisory" onBack={jest.fn()} />,
    );
    expect(screen.queryByTestId('update-official-source')).toBeNull();
  });

  it('opens the real official source when checked', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);

    await renderWithProviders(
      <UpdateDetailScreen updateId="update-soil-testing-initiative" onBack={jest.fn()} />,
    );
    await fireEvent.press(screen.getByTestId('update-official-source'));

    expect(openSpy).toHaveBeenCalledWith('https://soilhealth.dac.gov.in');
    openSpy.mockRestore();
  });

  it('shows a not-found state for an unknown update id instead of crashing', async () => {
    await renderWithProviders(<UpdateDetailScreen updateId="does-not-exist" onBack={jest.fn()} />);

    expect(screen.getByTestId('update-not-found')).toBeTruthy();
  });
});

describe('UpdateDetailScreen — a real backend update', () => {
  function realUpdate(overrides: Partial<KrishiUpdate> = {}): KrishiUpdate {
    return {
      id: 'gdelt:real-1',
      title: 'Flood alert issued for Gorakhpur district',
      summary: 'Heavy rainfall expected over the next 48 hours.',
      category: 'risk',
      source: { name: 'news.example.com', type: 'reported' },
      sourceUrl: 'https://news.example.com/flood-gorakhpur',
      publishedAt: new Date().toISOString(),
      relevance: { score: 40, reasons: ['Relevant to Gorakhpur', 'Published today'] },
      ...overrides,
    };
  }

  it('renders the title, source, summary and why-relevant reasons', async () => {
    cacheUpdates([realUpdate()]);

    await renderWithProviders(<UpdateDetailScreen updateId="gdelt:real-1" onBack={jest.fn()} />);

    expect(screen.getAllByText('Flood alert issued for Gorakhpur district').length).toBeGreaterThan(0);
    expect(screen.getByText('Heavy rainfall expected over the next 48 hours.')).toBeTruthy();
    expect(screen.getByText('Relevant to Gorakhpur')).toBeTruthy();
    expect(screen.getByText('Published today')).toBeTruthy();
  });

  it('marks an official source distinctly from a reported one', async () => {
    cacheUpdates([realUpdate({ id: 'sachet:real-2', source: { name: 'NDMA SACHET', type: 'official' } })]);

    await renderWithProviders(<UpdateDetailScreen updateId="sachet:real-2" onBack={jest.fn()} />);

    expect(screen.getByText('Official Source')).toBeTruthy();
  });

  it('opens the real source URL from the backend, not an invented one', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    cacheUpdates([realUpdate({ id: 'gdelt:real-3', sourceUrl: 'https://news.example.com/exact-story' })]);

    await renderWithProviders(<UpdateDetailScreen updateId="gdelt:real-3" onBack={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('update-official-source'));

    expect(openSpy).toHaveBeenCalledWith('https://news.example.com/exact-story');
    openSpy.mockRestore();
  });
});

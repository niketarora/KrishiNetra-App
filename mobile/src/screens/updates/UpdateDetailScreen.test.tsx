import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

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

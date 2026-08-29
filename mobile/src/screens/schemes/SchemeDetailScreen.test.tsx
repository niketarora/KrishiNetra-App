import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { SchemeDetailScreen } from './SchemeDetailScreen';

describe('SchemeDetailScreen', () => {
  it('renders what it is, the benefit, eligibility, documents and how to apply', async () => {
    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan" onBack={jest.fn()} />);

    expect(screen.getAllByText('PM-KISAN').length).toBeGreaterThan(0);
    expect(screen.getByText('What is it?')).toBeTruthy();
    expect(screen.getByText('Potential benefit')).toBeTruthy();
    expect(screen.getByText('Who may be eligible?')).toBeTruthy();
    expect(screen.getByText('Documents typically required')).toBeTruthy();
    expect(screen.getByText('Aadhaar card')).toBeTruthy();
    expect(screen.getByText('How to apply')).toBeTruthy();
  });

  it('always shows the illustrative-information disclaimer', async () => {
    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan" onBack={jest.fn()} />);

    expect(
      screen.getByText(
        "This information is for illustration and general awareness only. Always verify current eligibility and application details on the scheme's official website.",
      ),
    ).toBeTruthy();
  });

  it('opens the real official source when checked', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);

    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan" onBack={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('scheme-official-source'));

    expect(openSpy).toHaveBeenCalledWith('https://pmkisan.gov.in');
    openSpy.mockRestore();
  });

  it('shows a not-found state for an unknown scheme id instead of crashing', async () => {
    await renderWithProviders(<SchemeDetailScreen schemeId="does-not-exist" onBack={jest.fn()} />);

    expect(screen.getByTestId('scheme-not-found')).toBeTruthy();
  });
});

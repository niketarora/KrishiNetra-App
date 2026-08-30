import { Linking } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { SchemeDetailScreen } from './SchemeDetailScreen';

const mockSchemeDetail = {
  row_id: 'pm-kisan-1',
  name: 'Pradhan Mantri Kisan Samman Nidhi',
  short_title: 'PM-KISAN',
  category: 'Direct Benefit Transfer',
  what_is_it: 'A central sector scheme providing income support to all landholding farmers.',
  potential_benefit: 'Financial benefit of Rs. 6,000 per year in three equal installments.',
  who_may_be_eligible: 'All landholding farmers families having cultivable landholding in their names.',
  documents: ['Aadhaar Card', 'Land ownership documents', 'Bank account details'],
  how_to_apply: 'Apply through the official portal pmkisan.gov.in or via nearest CSC center.',
  official_source: 'https://pmkisan.gov.in',
  myscheme_url: 'https://www.myscheme.gov.in/schemes/pm-kisan',
};

const mockGetSchemeDetail = jest.fn();

jest.mock('@/services/schemes', () => ({
  getSchemeDetail: (...args: unknown[]) => mockGetSchemeDetail(...args),
}));

describe('SchemeDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSchemeDetail.mockResolvedValue(mockSchemeDetail);
  });

  it('renders what it is, the benefit, eligibility, documents and how to apply', async () => {
    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan-1" onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('PM-KISAN').length).toBeGreaterThan(0);
      expect(screen.getByText('What is it?')).toBeTruthy();
      expect(screen.getByText('Potential benefit')).toBeTruthy();
      expect(screen.getByText('Who may be eligible?')).toBeTruthy();
      expect(screen.getByText('Documents typically required')).toBeTruthy();
      expect(screen.getByText('Aadhaar Card')).toBeTruthy();
      expect(screen.getByText('How to apply')).toBeTruthy();
    });
  });

  it('always shows the illustrative-information disclaimer', async () => {
    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan-1" onBack={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "This information is for illustration and general awareness only. Always verify current eligibility and application details on the scheme's official website.",
        ),
      ).toBeTruthy();
    });
  });

  it('opens the real official source when checked', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);

    await renderWithProviders(<SchemeDetailScreen schemeId="pm-kisan-1" onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('scheme-official-source')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('scheme-official-source'));

    expect(openSpy).toHaveBeenCalledWith('https://pmkisan.gov.in');
    openSpy.mockRestore();
  });

  it('shows a not-found state for an unknown scheme id instead of crashing', async () => {
    mockGetSchemeDetail.mockRejectedValue(new Error('Not found'));

    await renderWithProviders(<SchemeDetailScreen schemeId="does-not-exist" onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('scheme-not-found')).toBeTruthy();
    });
  });
});

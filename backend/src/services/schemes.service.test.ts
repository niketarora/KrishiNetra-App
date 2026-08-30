import { getSchemeDetail, listSchemes, listSchemeStates } from './schemes.service.js';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockMaybeSingle = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));

jest.mock('../config/supabase.js', () => ({
  userClient: () => ({
    from: mockFrom,
  }),
}));

describe('schemes.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    mockEq.mockReturnValue({
      order: mockOrder,
      maybeSingle: mockMaybeSingle,
    });

    mockOrder.mockReturnValue({
      order: mockOrder,
      range: mockRange,
    });

    mockRange.mockResolvedValue({
      data: [
        {
          row_id: 'test-scheme-1',
          name: 'State Wheat Subsidy',
          short_title: 'Wheat Subsidy',
          category: 'Subsidy',
          scheme_scope: 'STATE',
          what_is_it: 'Provides subsidy for wheat seeds. Farmers receive 50% discount.',
          tags: ['wheat', 'seeds'],
        },
      ],
      error: null,
    });
  });

  it('lists unique sorted canonical states', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [
        { state: 'Rajasthan' },
        { state: 'Punjab' },
        { state: 'Rajasthan' },
        { state: 'Haryana' },
      ],
      error: null,
    });

    const states = await listSchemeStates('mock-token');

    expect(states).toEqual(['Haryana', 'Punjab', 'Rajasthan']);
  });

  it('lists schemes for a valid state with crop matching reason', async () => {
    // First call lists canonical states
    mockSelect.mockResolvedValueOnce({
      data: [{ state: 'Rajasthan' }],
      error: null,
    });

    const result = await listSchemes('mock-token', {
      state: 'Rajasthan',
      cropCode: 'wheat',
    });

    expect(result).toHaveLength(1);
    expect(result[0].row_id).toBe('test-scheme-1');
    expect(result[0].summary).toBe('Provides subsidy for wheat seeds.');
    expect(result[0].reasonKey).toBe('schemes.reasons.cropMatch');
  });

  it('throws INVALID_REQUEST for unknown state', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ state: 'Rajasthan' }],
      error: null,
    });

    await expect(
      listSchemes('mock-token', { state: 'InvalidStateName' }),
    ).rejects.toThrow('Unknown state');
  });

  it('fetches scheme detail by rowId', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        row_id: 'test-scheme-1',
        name: 'State Wheat Subsidy',
        short_title: 'Wheat Subsidy',
        category: 'Subsidy',
        what_is_it: 'Provides subsidy for wheat seeds.',
        potential_benefit: '50% discount on seeds',
        who_may_be_eligible: 'All farmers with less than 5 acres',
        documents: ['Aadhaar Card'],
        how_to_apply: 'Visit local agriculture department',
        official_source: 'https://agri.rajasthan.gov.in',
        myscheme_url: 'https://myscheme.gov.in/schemes/wheat-subsidy',
      },
      error: null,
    });

    const detail = await getSchemeDetail('mock-token', 'test-scheme-1');

    expect(detail.row_id).toBe('test-scheme-1');
    expect(detail.documents).toEqual(['Aadhaar Card']);
    expect(detail.official_source).toBe('https://agri.rajasthan.gov.in');
  });
});

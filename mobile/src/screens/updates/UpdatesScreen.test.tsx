import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { UpdatesScreen } from './UpdatesScreen';

const props = { onBack: jest.fn(), onOpenUpdate: jest.fn() };

describe('UpdatesScreen', () => {
  it('lists the demo updates with their category and title', async () => {
    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('New drought-resistant wheat variety announced')).toBeTruthy();
    expect(screen.getByText('Monsoon advisory for farmers')).toBeTruthy();
    expect(screen.getAllByText(/Agriculture ·|Weather ·|Government ·|Market ·|Technology ·/).length).toBe(5);
  });

  it('warns that the feed is sample data', async () => {
    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('sample-banner')).toBeTruthy();
  });

  it('opens an update with its id when its card is tapped', async () => {
    await renderWithProviders(<UpdatesScreen {...props} />);

    await fireEvent.press(screen.getByTestId('update-card-update-monsoon-advisory'));

    expect(props.onOpenUpdate).toHaveBeenCalledWith('update-monsoon-advisory');
  });
});

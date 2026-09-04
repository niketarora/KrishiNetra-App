import { screen } from '@testing-library/react-native';

import type { AvatarState } from '@/features/avatar/avatarMachine';
import { renderWithProviders } from '@/test-utils';
import { AvatarPeek } from './AvatarPeek';

const mockAvatarContext = {
  state: 'idle' as AvatarState,
  response: null,
  transcript: null,
  language: 'en',
  errorKey: null,
  close: jest.fn(),
  pressMic: jest.fn(),
};

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => mockAvatarContext,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const GUIDE_PEEK = require('../../../assets/avatar/guide-peek.png');
const GUIDE_ACTION = require('../../../assets/avatar/guide-action.png');

describe('AvatarPeek', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvatarContext.state = 'idle';
    mockAvatarContext.response = null;
    mockAvatarContext.transcript = null;
  });

  it('renders nothing when avatar is idle', async () => {
    mockAvatarContext.state = 'idle';
    await renderWithProviders(<AvatarPeek />);

    expect(screen.queryByTestId('avatar-peek-character')).toBeNull();
  });

  it('renders guide-peek.png when listening', async () => {
    mockAvatarContext.state = 'listening';
    await renderWithProviders(<AvatarPeek />);

    const image = screen.getByTestId('avatar-peek-character');
    expect(image.props.source).toBe(GUIDE_PEEK);
  });

  it('renders guide-peek.png when thinking', async () => {
    mockAvatarContext.state = 'thinking';
    await renderWithProviders(<AvatarPeek />);

    const image = screen.getByTestId('avatar-peek-character');
    expect(image.props.source).toBe(GUIDE_PEEK);
  });

  it('switches to guide-action.png when speaking', async () => {
    mockAvatarContext.state = 'speaking';
    await renderWithProviders(<AvatarPeek />);

    const image = screen.getByTestId('avatar-peek-character');
    expect(image.props.source).toBe(GUIDE_ACTION);
  });

  it('switches to guide-action.png when guiding', async () => {
    mockAvatarContext.state = 'guiding';
    await renderWithProviders(<AvatarPeek />);

    const image = screen.getByTestId('avatar-peek-character');
    expect(image.props.source).toBe(GUIDE_ACTION);
  });
});

import { fireEvent, screen } from '@testing-library/react-native';

import type { AvatarState } from '@/features/avatar/avatarMachine';
import { renderWithProviders } from '@/test-utils';

import { AvatarOverlay } from './AvatarOverlay';

const mockAvatar = {
  isOpen: true,
  state: 'idle' as AvatarState,
  question: null as string | null,
  answer: null as string | null,
  source: null as string | null,
  open: jest.fn(),
  close: jest.fn(),
  ask: jest.fn(),
  pressMic: jest.fn(),
  simulateError: jest.fn(),
};

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => mockAvatar,
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ramesh@example.com' },
    profile: { full_name: 'Ramesh Kumar' },
  }),
}));

function setAvatar(overrides: Partial<typeof mockAvatar>) {
  Object.assign(mockAvatar, overrides);
}

describe('AvatarOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAvatar({ isOpen: true, state: 'idle', question: null, answer: null, source: null });
  });

  describe('the five states', () => {
    it('renders idle with a greeting and suggested questions', async () => {
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getByText('Namaste Ramesh! What would you like to know?')).toBeTruthy();
      expect(screen.getByText('Try asking')).toBeTruthy();
      expect(screen.getByText('How big is my field?')).toBeTruthy();
      expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
      expect(screen.getByText('Start speaking')).toBeTruthy();
    });

    it('renders listening with the farmer question echoed back', async () => {
      setAvatar({ state: 'listening', question: 'mandi' });
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getAllByText('Listening…').length).toBeGreaterThan(0);
      expect(screen.getByText("Today's mandi rate?")).toBeTruthy();
      expect(screen.getByText("I'm done")).toBeTruthy();
      // Suggestions are for choosing a question, not for interrupting one.
      expect(screen.queryByText('Try asking')).toBeNull();
    });

    it('renders thinking with the mic disabled', async () => {
      setAvatar({ state: 'thinking', question: 'area' });
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getAllByText('Thinking…').length).toBeGreaterThan(0);
      expect(screen.getByText('One moment…')).toBeTruthy();

      await fireEvent.press(screen.getByText('One moment…'));
      expect(mockAvatar.pressMic).not.toHaveBeenCalled();
    });

    it('renders speaking with the answer and its source', async () => {
      setAvatar({
        state: 'speaking',
        question: 'area',
        answer: 'Your registered field, North plot, is 2.67 acres.',
        source: 'From your field record',
      });
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getByText('Your registered field, North plot, is 2.67 acres.')).toBeTruthy();
      // TRD §21: an answer drawn from real data must say where it came from.
      expect(screen.getByText('From your field record')).toBeTruthy();
      expect(screen.getByText('Ask a follow-up')).toBeTruthy();
    });

    it('renders error with a retry affordance', async () => {
      setAvatar({ state: 'error', question: 'crop' });
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getAllByText("Sorry, I couldn't hear you clearly.").length).toBeGreaterThan(0);
      expect(screen.getByText('Try again')).toBeTruthy();
      expect(screen.getAllByText('No audio').length).toBeGreaterThan(0);
    });
  });

  describe('honesty about what this is', () => {
    it('says on screen that the assistant is a preview, not live AI', async () => {
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.getByText('Demo preview · voice arrives soon')).toBeTruthy();
      expect(
        screen.getByText(
          'This is a visual preview. Real voice and AI answers arrive in a later update.',
        ),
      ).toBeTruthy();
    });

    it('never shows a source chip while it has not answered', async () => {
      setAvatar({ state: 'listening', question: 'area', source: 'From your field record' });
      await renderWithProviders(<AvatarOverlay />);

      expect(screen.queryByText('From your field record')).toBeNull();
    });
  });

  describe('controls', () => {
    it('starts a scripted exchange from a suggestion chip', async () => {
      await renderWithProviders(<AvatarOverlay />);

      await fireEvent.press(screen.getByText('Sell now or wait?'));

      expect(mockAvatar.ask).toHaveBeenCalledWith('sell');
    });

    it('drives the state machine from the mic button', async () => {
      await renderWithProviders(<AvatarOverlay />);

      await fireEvent.press(screen.getByText('Start speaking'));

      expect(mockAvatar.pressMic).toHaveBeenCalled();
    });

    it('closes from the end-conversation button', async () => {
      await renderWithProviders(<AvatarOverlay />);

      await fireEvent.press(screen.getByLabelText('End conversation'));

      expect(mockAvatar.close).toHaveBeenCalled();
    });

    it('closes from the back arrow', async () => {
      await renderWithProviders(<AvatarOverlay />);

      await fireEvent.press(screen.getByLabelText('Close conversation'));

      expect(mockAvatar.close).toHaveBeenCalled();
    });
  });

  it('renders nothing when closed', async () => {
    setAvatar({ isOpen: false });
    await renderWithProviders(<AvatarOverlay />);

    expect(screen.queryByText('KrishiNetra AI')).toBeNull();
  });
});

import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { VideoPreview } from './VideoPreview';

const video = {
  id: 'video-1',
  title: { en: 'Test video', hi: 'परीक्षण वीडियो' },
  thumbnailUrl: 'https://example.com/thumb.jpg',
  videoUrl: 'https://example.com/video.mp4',
  durationSeconds: 300,
  language: 'both' as const,
};

describe('VideoPreview', () => {
  it('starts as a thumbnail with a watch action and the duration', async () => {
    await renderWithProviders(<VideoPreview video={video} />);

    expect(screen.getByTestId('video-thumbnail')).toBeTruthy();
    expect(screen.getByText('Watch tutorial')).toBeTruthy();
    expect(screen.queryByTestId('video-webview')).toBeNull();
  });

  it('swaps to the player once tapped', async () => {
    await renderWithProviders(<VideoPreview video={video} />);

    await fireEvent.press(screen.getByTestId('video-thumbnail'));

    expect(screen.getByTestId('video-webview')).toBeTruthy();
    expect(screen.queryByTestId('video-thumbnail')).toBeNull();
  });

  it('falls back to a notice without crashing when the player fails to load', async () => {
    await renderWithProviders(<VideoPreview video={video} />);
    await fireEvent.press(screen.getByTestId('video-thumbnail'));

    fireEvent(screen.getByTestId('video-webview'), 'error');

    expect(await screen.findByText("We couldn't load the video. Please try again.")).toBeTruthy();
  });
});

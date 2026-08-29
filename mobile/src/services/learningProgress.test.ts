import * as SecureStore from 'expo-secure-store';

import { getCompletedTutorialIds, markTutorialComplete } from './learningProgress';

const mockedGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockedSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;

describe('learningProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCompletedTutorialIds', () => {
    it('returns an empty list when nothing has been saved yet', async () => {
      mockedGet.mockResolvedValueOnce(null);

      expect(await getCompletedTutorialIds('user-1')).toEqual([]);
    });

    it('returns the saved ids', async () => {
      mockedGet.mockResolvedValueOnce(JSON.stringify(['soil-preparation-before-sowing']));

      expect(await getCompletedTutorialIds('user-1')).toEqual(['soil-preparation-before-sowing']);
    });

    it('keys storage per farmer, not globally', async () => {
      mockedGet.mockResolvedValueOnce(null);
      await getCompletedTutorialIds('farmer-42');

      expect(mockedGet).toHaveBeenCalledWith('krishinetra.learning.completed.farmer-42');
    });

    it('treats corrupt or unexpected stored data as no progress, not a crash', async () => {
      mockedGet.mockResolvedValueOnce('not json');
      expect(await getCompletedTutorialIds('user-1')).toEqual([]);

      mockedGet.mockResolvedValueOnce(JSON.stringify({ not: 'an array' }));
      expect(await getCompletedTutorialIds('user-1')).toEqual([]);
    });

    it('fails soft when the store throws', async () => {
      mockedGet.mockRejectedValueOnce(new Error('boom'));

      expect(await getCompletedTutorialIds('user-1')).toEqual([]);
    });
  });

  describe('markTutorialComplete', () => {
    it('adds a tutorial to an empty list and persists it', async () => {
      mockedGet.mockResolvedValueOnce(null);

      const result = await markTutorialComplete('user-1', 'sowing-seed-depth-and-spacing');

      expect(result).toEqual(['sowing-seed-depth-and-spacing']);
      expect(mockedSet).toHaveBeenCalledWith(
        'krishinetra.learning.completed.user-1',
        JSON.stringify(['sowing-seed-depth-and-spacing']),
      );
    });

    it('does not duplicate a tutorial that is already complete', async () => {
      mockedGet.mockResolvedValueOnce(JSON.stringify(['soil-preparation-before-sowing']));

      const result = await markTutorialComplete('user-1', 'soil-preparation-before-sowing');

      expect(result).toEqual(['soil-preparation-before-sowing']);
      expect(mockedSet).not.toHaveBeenCalled();
    });

    it('still reports success in memory when the write itself fails', async () => {
      mockedGet.mockResolvedValueOnce(null);
      mockedSet.mockRejectedValueOnce(new Error('boom'));

      const result = await markTutorialComplete('user-1', 'harvesting-at-the-right-time');

      expect(result).toEqual(['harvesting-at-the-right-time']);
    });
  });
});

import { useCallback, useEffect, useState } from 'react';

import { getCompletedTutorialIds, markTutorialComplete } from '@/services/learningProgress';

export type LearningProgress = {
  loading: boolean;
  completedCount: number;
  isComplete: (tutorialId: string) => boolean;
  markComplete: (tutorialId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Loads and updates which tutorials a farmer has completed.
 *
 * Shaped like `useHomeInsights.ts`: one small hook wrapping a service, no
 * global provider. Learning progress is only ever read by the two Learning
 * screens, so a context provider mounted app-wide would be more machinery
 * than the feature needs.
 */
export function useLearningProgress(userId: string | null): LearningProgress {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCompletedIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    const ids = await getCompletedTutorialIds(userId);
    setCompletedIds(new Set(ids));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markComplete = useCallback(
    async (tutorialId: string) => {
      if (!userId) return;
      const ids = await markTutorialComplete(userId, tutorialId);
      setCompletedIds(new Set(ids));
    },
    [userId],
  );

  const isComplete = useCallback((tutorialId: string) => completedIds.has(tutorialId), [completedIds]);

  return { loading, completedCount: completedIds.size, isComplete, markComplete, refresh };
}

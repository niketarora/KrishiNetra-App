import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { updateProfile } from '@/services/profiles';
import i18n, { deviceLanguage, isSupportedLanguage, type LanguageCode } from '@/i18n';

const STORAGE_KEY = 'krishinetra.language';

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Resolution order: the farmer's explicit choice (stored on device), then the
 * language on their profile, then the device locale. The device-local copy is
 * what makes the login screen appear in the right language before there is any
 * session to read a profile from.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n: instance } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(
    isSupportedLanguage(instance.language) ? instance.language : deviceLanguage(),
  );

  const apply = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    void i18n.changeLanguage(code);
  }, []);

  useEffect(() => {
    let active = true;

    void SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (isSupportedLanguage(stored)) {
        apply(stored);
      } else if (isSupportedLanguage(profile?.language)) {
        apply(profile.language);
      }
    });

    return () => {
      active = false;
    };
    // Runs once on mount, and again when a profile first arrives after login.
  }, [apply, profile?.language]);

  const setLanguage = useCallback(
    async (code: LanguageCode) => {
      apply(code);
      await SecureStore.setItemAsync(STORAGE_KEY, code);

      // Persist to the profile so the choice follows the farmer to a new device.
      if (user?.id) {
        try {
          await updateProfile(user.id, { language: code });
          await refreshProfile();
        } catch {
          // A failed sync must not undo the farmer's visible choice.
        }
      }
    },
    [apply, refreshProfile, user?.id],
  );

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside a LanguageProvider.');
  return context;
}

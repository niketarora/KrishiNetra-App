import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import i18n, { deviceLanguage, isSupportedLanguage } from '@/i18n';
import { mapAuthError, DataError, type AuthErrorKey } from '@/services/errors';
import { requestOtp, verifyOtp } from '@/services/phoneAuth';
import { getProfile, type Profile } from '@/services/profiles';
import { setLocalAccessToken, supabase } from '@/services/supabase';

type PhoneAuthErrorKey =
  | AuthErrorKey
  | 'auth.errors.otpInvalid'
  | 'auth.errors.otpExpired'
  | 'auth.errors.otpTooManyAttempts'
  | 'auth.errors.authUnavailable';

type AuthResult = { ok: true } | { ok: false; errorKey: PhoneAuthErrorKey };
type OtpRequestResult = { ok: true; devCode: string } | { ok: false; errorKey: AuthErrorKey };

type AuthContextValue = {
  /** True until the stored session has been checked — gates the splash screen. */
  initializing: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: (input: { email: string; password: string; fullName: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  /** Phone-first signup/login via backend OTP and Supabase MagicLink verification. */
  requestPhoneOtp: (normalizedPhone: string) => Promise<OtpRequestResult>;
  verifyPhoneOtp: (normalizedPhone: string, code: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await getProfile(userId));
    } catch {
      // A missing profile must never block the app — the greeting simply falls
      // back to the email local-part until the row is readable.
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const timeout = setTimeout(() => {
      if (active) setInitializing(false);
    }, 1500);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id);
      })
      .catch(() => {
        // Fallback gracefully on session fetch error
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setInitializing(false);
      });

    // Keeps the app in step with token refreshes and sign-outs triggered
    // anywhere, including from another tab of the same Supabase project.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        setLocalAccessToken(null);
        setSession(null);
        setProfile(null);
      } else if (nextSession) {
        setLocalAccessToken(nextSession.access_token);
        setSession(nextSession);
        void loadProfile(nextSession.user.id);
      }
    });

    return () => {
      active = false;
      clearTimeout(timeout);
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ email, password, fullName }) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      // Read by the handle_new_user trigger to seed the profile row.
      options: { data: { full_name: fullName.trim() } },
    });

    if (error) return { ok: false, errorKey: mapAuthError(error) };
    return { ok: true };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return { ok: false, errorKey: mapAuthError(error) };
    return { ok: true };
  }, []);

  const requestPhoneOtp = useCallback<AuthContextValue['requestPhoneOtp']>(async (normalizedPhone) => {
    try {
      const { devCode } = await requestOtp(normalizedPhone);
      return { ok: true, devCode };
    } catch (error) {
      const errorKey = error instanceof DataError ? (error.translationKey as AuthErrorKey) : 'auth.errors.generic';
      return { ok: false, errorKey };
    }
  }, []);

  const verifyPhoneOtp = useCallback<AuthContextValue['verifyPhoneOtp']>(async (normalizedPhone, code) => {
    const language = isSupportedLanguage(i18n.language) ? i18n.language : deviceLanguage();
    try {
      const { tokenHash, session: directSession } = await verifyOtp(normalizedPhone, code, language);

      if (directSession?.access_token && directSession?.refresh_token) {
        setLocalAccessToken(directSession.access_token);
        const newSession: Session = {
          access_token: directSession.access_token,
          refresh_token: directSession.refresh_token,
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: directSession.user as Session['user'],
        };
        setSession(newSession);
        void loadProfile(newSession.user.id);

        // Background session storage without throwing if Supabase cloud DNS is unreachable
        void supabase.auth.setSession({
          access_token: directSession.access_token,
          refresh_token: directSession.refresh_token,
        }).catch(() => {});

        return { ok: true };
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (error) {
        return { ok: false, errorKey: mapAuthError(error) };
      }
      return { ok: true };
    } catch (error) {
      const errorKey =
        error instanceof DataError ? (error.translationKey as PhoneAuthErrorKey) : 'auth.errors.generic';
      return { ok: false, errorKey };
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    setLocalAccessToken(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Best-effort signout when offline
    }
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [loadProfile, session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      profile,
      signUp,
      signIn,
      requestPhoneOtp,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    }),
    [
      initializing,
      session,
      profile,
      signUp,
      signIn,
      requestPhoneOtp,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

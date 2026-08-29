import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { demoOtpProvider } from '@/features/auth/demoOtp';
import { getOrCreateBridgePassword, phoneToBridgeEmail } from '@/features/auth/phoneIdentity';
import i18n, { deviceLanguage, isSupportedLanguage } from '@/i18n';
import { mapAuthError, type AuthErrorKey } from '@/services/errors';
import { getProfile, type Profile } from '@/services/profiles';
import { supabase } from '@/services/supabase';

type PhoneAuthErrorKey = AuthErrorKey | 'auth.errors.otpInvalid' | 'auth.errors.phoneAlreadyLinkedOnAnotherDevice';
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
  /** Phone-first signup/login — see `features/auth/demoOtp.ts` for why this is a demo mechanism. */
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

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    // Keeps the app in step with token refreshes and sign-outs triggered
    // anywhere, including from another tab of the same Supabase project.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession?.user.id);
    });

    return () => {
      active = false;
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
    const { devCode } = demoOtpProvider.request(normalizedPhone);
    return { ok: true, devCode };
  }, []);

  const verifyPhoneOtp = useCallback<AuthContextValue['verifyPhoneOtp']>(async (normalizedPhone, code) => {
    if (!demoOtpProvider.verify(normalizedPhone, code)) {
      return { ok: false, errorKey: 'auth.errors.otpInvalid' };
    }

    const email = phoneToBridgeEmail(normalizedPhone);
    const password = await getOrCreateBridgePassword(normalizedPhone);

    const signInResult = await supabase.auth.signInWithPassword({ email, password });
    if (!signInResult.error) return { ok: true };

    // First time this phone has verified on this device — create its account.
    // Read by `handle_new_user()` (0005_farmer_identity.sql) to seed phone
    // and language, the same pattern already used for full_name.
    const language = isSupportedLanguage(i18n.language) ? i18n.language : deviceLanguage();
    const signUpResult = await supabase.auth.signUp({
      email,
      password,
      options: { data: { phone: normalizedPhone, language } },
    });

    if (signUpResult.error) {
      const mappedKey = mapAuthError(signUpResult.error);
      // "Already registered" here means this phone verified successfully on a
      // *different* device before (see phoneIdentity.ts's file comment on why
      // the bridge password is device-local) — not that an email is taken, so
      // the farmer gets an honest, phone-specific message instead.
      if (mappedKey === 'auth.errors.emailTaken') {
        return { ok: false, errorKey: 'auth.errors.phoneAlreadyLinkedOnAnotherDevice' };
      }
      return { ok: false, errorKey: mappedKey };
    }
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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

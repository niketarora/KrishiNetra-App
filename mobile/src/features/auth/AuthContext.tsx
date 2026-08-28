import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { mapAuthError, type AuthErrorKey } from '@/services/errors';
import { getProfile, type Profile } from '@/services/profiles';
import { supabase } from '@/services/supabase';

type AuthResult = { ok: true } | { ok: false; errorKey: AuthErrorKey };

type AuthContextValue = {
  /** True until the stored session has been checked — gates the splash screen. */
  initializing: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: (input: { email: string; password: string; fullName: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
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
      signOut,
      refreshProfile,
    }),
    [initializing, session, profile, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

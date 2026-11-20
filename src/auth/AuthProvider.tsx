import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { initialLinkError, supabase, supabaseConfigProblem } from '../lib/supabase';
import { AuthContext, type AuthContextValue, type AuthState, type ProfileState } from './context';
import { DB_TIMEOUT_MS, authErrorMessage, dbErrorMessage } from './errors';
import { initialRecoveryState, storeRecovery } from './recovery';
import { PROFILE_COLUMNS, parseProfile } from './types';

const redirectTo = (path: string) => `${window.location.origin}${path}`;

type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null; epoch: number };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>({ status: 'loading' });
  // Профиль помечен ключом «пользователь:версия», чтобы не показать чужой или устаревший профиль.
  const [profileEntry, setProfileEntry] = useState<{ key: string; state: ProfileState } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const [recovery, setRecoveryState] = useState(initialRecoveryState);
  const setRecovery = useCallback((active: boolean) => {
    storeRecovery(active);
    setRecoveryState(active);
  }, []);
  const [linkError] = useState(initialLinkError);

  // Номер сессии меняется прямо при обработке события авторизации — при каждой смене пользователя,
  // включая выход (A → нет) и вход (нет → A). Не зависит от того, был ли рендер между событиями:
  // SIGNED_OUT и SIGNED_IN того же пользователя подряд дают два увеличения. Обновление токена
  // (тот же пользователь) номер не меняет. Изменяется в обработчике, а не в апдейтере setState,
  // потому что апдейтеры в StrictMode вызываются дважды.
  const sessionEpochRef = useRef(0);
  const sessionUserRef = useRef<string | null>(null);
  // Выход по кнопке «Выйти»: после него не возвращаем следующего пользователя на страницу прежнего.
  const [explicitSignOut, setExplicitSignOut] = useState(false);
  const applySession = useCallback((session: Session | null) => {
    const nextUser = session?.user.id ?? null;
    if (nextUser !== sessionUserRef.current) {
      sessionUserRef.current = nextUser;
      sessionEpochRef.current += 1;
    }
    if (nextUser) setExplicitSignOut(false);
    setSessionState({ status: 'ready', session, epoch: sessionEpochRef.current });
  }, []);

  // Восстановление сессии и подписка на изменения.
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) applySession(data.session);
    });

    // Внутри колбэка не вызываем другие методы Supabase (рекомендация документации).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      applySession(session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [setRecovery, applySession]);

  const userId = sessionState.status === 'ready' ? (sessionState.session?.user.id ?? null) : null;

  const sessionEpoch = sessionState.status === 'ready' ? sessionState.epoch : 0;
  const sessionKey = userId ? `${userId}:${sessionEpoch}` : null;
  const profileKey = sessionKey ? `${sessionKey}:${profileVersion}` : null;

  // Актуальный ключ для асинхронных операций: ответ применяется, только если сессия не сменилась.
  const currentProfileKey = useRef<string | null>(profileKey);
  useEffect(() => {
    currentProfileKey.current = profileKey;
  }, [profileKey]);

  // Загрузка профиля текущего пользователя.
  useEffect(() => {
    if (!supabase || !userId || !profileKey) return;
    let active = true;
    const setProfile = (state: ProfileState) => setProfileEntry({ key: profileKey, state });
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setProfile({ status: 'error', message: dbErrorMessage(error) });
          return;
        }
        const parsed = parseProfile(data);
        setProfile(
          parsed
            ? { status: 'ready', profile: parsed }
            : { status: 'error', message: 'Профиль не найден. Проверьте, что миграции Supabase применены.' },
        );
      });
    return () => {
      active = false;
    };
  }, [userId, profileKey]);

  const state: AuthState = useMemo(() => {
    if (supabaseConfigProblem) return { status: 'unconfigured', problem: supabaseConfigProblem };
    if (sessionState.status === 'loading') return { status: 'loading' };
    const session = sessionState.session;
    if (!session) return { status: 'signed_out' };
    const profile: ProfileState =
      profileEntry && profileEntry.key === profileKey ? profileEntry.state : { status: 'loading' };
    return { status: 'signed_in', user: session.user, profile };
  }, [sessionState, profileEntry, profileKey]);

  const reloadProfile = useCallback(() => setProfileVersion((v) => v + 1), []);

  const value = useMemo<AuthContextValue>(() => {
    const notConfigured = 'Подключение к Supabase не настроено.';

    return {
      state,
      sessionKey,
      explicitSignOut,
      recovery,
      linkError,
      reloadProfile,
      finishRecovery: () => setRecovery(false),

      async signUp(name, email, password) {
        if (!supabase) return { error: notConfigured };
        try {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo('/') },
          });
          if (error) return { error: authErrorMessage(error) };
          return { error: null, needsConfirmation: data.session === null };
        } catch (e) {
          return { error: authErrorMessage(e) };
        }
      },

      async signIn(email, password) {
        if (!supabase) return { error: notConfigured, unconfirmed: false };
        try {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (!error) return { error: null, unconfirmed: false };
          return { error: authErrorMessage(error), unconfirmed: error.code === 'email_not_confirmed' };
        } catch (e) {
          return { error: authErrorMessage(e), unconfirmed: false };
        }
      },

      async signOut() {
        if (!supabase) return { error: notConfigured };
        setExplicitSignOut(true);
        try {
          const { error } = await supabase.auth.signOut();
          if (error) setExplicitSignOut(false);
          return { error: error ? authErrorMessage(error) : null };
        } catch (e) {
          return { error: authErrorMessage(e) };
        }
      },

      async resendConfirmation(email) {
        if (!supabase) return { error: notConfigured };
        try {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: { emailRedirectTo: redirectTo('/') },
          });
          return { error: error ? authErrorMessage(error) : null };
        } catch (e) {
          return { error: authErrorMessage(e) };
        }
      },

      async requestPasswordReset(email) {
        if (!supabase) return { error: notConfigured };
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: redirectTo('/reset-password'),
          });
          return { error: error ? authErrorMessage(error) : null };
        } catch (e) {
          return { error: authErrorMessage(e) };
        }
      },

      async updatePassword(password) {
        if (!supabase) return { error: notConfigured };
        try {
          const { error } = await supabase.auth.updateUser({ password });
          return { error: error ? authErrorMessage(error) : null };
        } catch (e) {
          return { error: authErrorMessage(e) };
        }
      },

      async updateName(name) {
        if (!supabase || state.status !== 'signed_in' || !profileKey) return { error: notConfigured, stale: false };
        // Ключ сессии, в которой начат запрос. Если к ответу сессия сменилась, результат отбрасывается:
        // он не меняет ни профиль, ни ошибку, ни состояние загрузки новой сессии.
        const requestKey = profileKey;
        const requestEpoch = sessionEpochRef.current;
        // Смена сессии видна сразу через ref обработчика событий (до рендера и эффектов);
        // смена версии профиля — через актуальный ключ.
        const isStale = () => sessionEpochRef.current !== requestEpoch || currentProfileKey.current !== requestKey;
        let data: unknown;
        try {
          const result = await supabase
            .from('profiles')
            .update({ full_name: name.trim() })
            .eq('id', state.user.id)
            .select(PROFILE_COLUMNS)
            .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
            .maybeSingle();
          if (isStale()) return { error: null, stale: true };
          if (result.error) return { error: dbErrorMessage(result.error), stale: false };
          data = result.data;
        } catch (e) {
          if (isStale()) return { error: null, stale: true };
          return { error: dbErrorMessage({ message: e instanceof Error ? e.message : String(e) }), stale: false };
        }
        const parsed = parseProfile(data);
        if (!parsed) return { error: 'Не удалось сохранить: профиль не найден.', stale: false };
        // Функциональное обновление: меняем запись, только если она всё ещё принадлежит этой сессии.
        setProfileEntry((prev) =>
          prev && prev.key === requestKey ? { key: requestKey, state: { status: 'ready', profile: parsed } } : prev,
        );
        return { error: null, stale: false };
      },
    };
  }, [state, sessionKey, explicitSignOut, recovery, linkError, reloadProfile, profileKey, setRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

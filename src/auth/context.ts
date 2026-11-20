import type { User } from '@supabase/supabase-js';
import { createContext } from 'react';
import type { SupabaseConfigProblem } from '../lib/supabase';
import type { Profile } from './types';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; message: string };

export type AuthState =
  | { status: 'unconfigured'; problem: SupabaseConfigProblem }
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: User; profile: ProfileState };

export type SignUpResult = { error: string } | { error: null; needsConfirmation: boolean };
export type ActionResult = { error: string | null };
export type SignInResult = { error: string | null; unconfirmed: boolean };
/** stale = true: ответ пришёл после смены сессии и отброшен. */
export type UpdateNameResult = { error: string | null; stale: boolean };

export interface AuthContextValue {
  state: AuthState;
  /** Идентификатор текущей сессии («пользователь:номер»); меняется при выходе и каждом входе. */
  sessionKey: string | null;
  /** Пользователь вышел сам (кнопка «Выйти»): страницу для возврата после входа не запоминаем. */
  explicitSignOut: boolean;
  /** Пользователь пришёл по ссылке восстановления пароля. */
  recovery: boolean;
  /** Ошибка из ссылки в письме (устарела и т. п.). */
  linkError: string | null;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<ActionResult>;
  resendConfirmation: (email: string) => Promise<ActionResult>;
  requestPasswordReset: (email: string) => Promise<ActionResult>;
  updatePassword: (password: string) => Promise<ActionResult>;
  updateName: (name: string) => Promise<UpdateNameResult>;
  reloadProfile: () => void;
  finishRecovery: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

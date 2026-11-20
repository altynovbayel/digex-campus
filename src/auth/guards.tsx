import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader, FullPageMessage } from '../components/FullPageState';
import { LogoutButton } from '../components/LogoutButton';
import { SetupNotice } from '../components/SetupNotice';
import { useAuth } from './useAuth';

interface FromState {
  from?: string;
}

function readFrom(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = (state as FromState).from;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  }
  return '/';
}

/**
 * Пропускает только вошедшего пользователя с загруженным профилем.
 * Это защита интерфейса; данные дополнительно защищены RLS в базе.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, recovery, reloadProfile, explicitSignOut } = useAuth();
  const location = useLocation();

  if (state.status === 'unconfigured') {
    return (
      <FullPageMessage title="Требуется настройка">
        <SetupNotice problem={state.problem} />
      </FullPageMessage>
    );
  }
  if (state.status === 'loading') return <FullPageLoader label="Проверяем вход…" />;
  if (state.status === 'signed_out') {
    // После явного выхода страницу не запоминаем: следующий вошедший не попадёт на страницу прежнего пользователя.
    return (
      <Navigate to="/login" replace state={explicitSignOut ? undefined : { from: location.pathname + location.search }} />
    );
  }
  if (recovery) return <Navigate to="/reset-password" replace />;

  if (state.profile.status === 'loading') return <FullPageLoader label="Загружаем профиль…" />;
  if (state.profile.status === 'error') {
    return (
      <FullPageMessage title="Не удалось загрузить профиль">
        <p className="muted">{state.profile.message}</p>
        <div className="form__actions">
          <button type="button" className="btn btn--primary" onClick={reloadProfile}>
            Повторить
          </button>
          <LogoutButton className="btn btn--secondary" />
        </div>
      </FullPageMessage>
    );
  }
  return <>{children}</>;
}

/** Пропускает только администратора. Используется внутри RequireAuth. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== 'signed_in' || state.profile.status !== 'ready') return null;
  if (state.profile.profile.role !== 'admin') {
    return (
      <FullPageMessage title="Нет доступа">
        <div className="empty">
          <ShieldX className="empty__icon" size={36} aria-hidden="true" />
          <p className="empty__text">Панель администратора доступна только администраторам.</p>
        </div>
        <Link to="/" className="btn btn--primary btn--block">
          В кабинет
        </Link>
      </FullPageMessage>
    );
  }
  return <>{children}</>;
}

/** Страницы входа/регистрации: вошедшего пользователя отправляем в кабинет. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state, recovery } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <FullPageLoader />;
  if (state.status === 'signed_in') {
    return <Navigate to={recovery ? '/reset-password' : readFrom(location.state)} replace />;
  }
  return <>{children}</>;
}

import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchLesson, fetchMyLearning, fetchSectionLessons } from '../api/learning';
import { useAuth } from '../auth/useAuth';
import { FullPageLoader, FullPageMessage } from '../components/FullPageState';
import { LogoutButton } from '../components/LogoutButton';
import { useSessionQuery } from '../lib/useSessionQuery';
import { CabinetContext, type CabinetValue } from './context';

/**
 * Кабинет настоящего пользователя: назначения, статусы доступа и оплаты — из базы.
 * Статус доступа вычисляет база по серверному времени; уроки отдаёт только RLS.
 * При ошибке показывается ошибка — демо-данные не подставляются никогда.
 */
export function LiveCabinetProvider({ children }: { children: ReactNode }) {
  const { state, sessionKey } = useAuth();
  const userId = state.status === 'signed_in' ? state.user.id : null;
  const { state: learning, reload, refreshError } = useSessionQuery(
    sessionKey && userId ? `learning:${sessionKey}` : null,
    () => fetchMyLearning(userId ?? ''),
  );

  // Открытая страница не должна показывать устаревший доступ: перепроверяем статус
  // в момент окончания общего периода (по серверному времени), при возврате во вкладку
  // и раз в 5 минут (отзыв, архив раздела или новая активация администратором).
  const learningData = learning.status === 'ready' ? learning.data : null;
  // В момент окончания периода материалы скрываются сразу, не дожидаясь ответа сервера.
  const [locallyExpiredAt, setLocallyExpiredAt] = useState<string | null>(null);
  useEffect(() => {
    if (!learningData) return;
    const timers: number[] = [];
    const serverNow = Date.now() + learningData.clockOffsetMs;
    const { access } = learningData;
    const endsAt = access.endsAt;
    const nextEnd = access.status === 'active' && endsAt ? Date.parse(endsAt) : NaN;
    if (endsAt && Number.isFinite(nextEnd)) {
      // Предел setTimeout — около 24,8 суток.
      const untilEnd = Math.min(Math.max(nextEnd - serverNow, 0), 2_000_000_000);
      timers.push(window.setTimeout(() => setLocallyExpiredAt(endsAt), untilEnd));
      // Перепроверка на сервере: +1 с, потому что там условие строгое (now() < окончание).
      timers.push(window.setTimeout(reload, untilEnd + 1000));
    }
    timers.push(window.setInterval(reload, 5 * 60 * 1000));
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [learningData, reload]);

  const value = useMemo<CabinetValue | null>(() => {
    if (state.status !== 'signed_in' || state.profile.status !== 'ready' || !sessionKey) return null;
    if (learning.status !== 'ready') return null;
    const { profile } = state.profile;
    const serverAccess = learning.data.access;
    const access =
      serverAccess.status === 'active' && serverAccess.endsAt !== null && serverAccess.endsAt === locallyExpiredAt
        ? { ...serverAccess, status: 'expired' as const }
        : serverAccess;
    return {
      mode: 'live',
      user: { id: profile.id, name: profile.fullName, email: state.user.email ?? '' },
      access,
      sections: learning.data.sections,
      payments: learning.data.payments,
      results: learning.data.attempts,
      stats: learning.data.stats,
      availableLessons: learning.data.availableLessons,
      dataKey: sessionKey,
      revision: learning.data.fetchedAt,
      listLessons: fetchSectionLessons,
      getLesson: fetchLesson,
      reload,
      refreshError,
    };
  }, [state, sessionKey, learning, reload, locallyExpiredAt, refreshError]);

  if (learning.status === 'error') {
    return (
      <FullPageMessage title="Не удалось загрузить обучение">
        <p className="muted">{learning.message}</p>
        <div className="form__actions">
          <button type="button" className="btn btn--primary" onClick={reload}>
            <RotateCcw size={16} aria-hidden="true" /> Повторить
          </button>
          <LogoutButton className="btn btn--secondary" />
        </div>
      </FullPageMessage>
    );
  }
  if (!value) return <FullPageLoader label="Загружаем обучение…" />;
  return <CabinetContext.Provider value={value}>{children}</CabinetContext.Provider>;
}

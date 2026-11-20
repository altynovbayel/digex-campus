import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '../api/client';

export type QueryState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/**
 * Загрузка данных, привязанная к ключу (сессия пользователя + параметры запроса).
 * Ответ применяется, только если ключ и версия не изменились к моменту ответа:
 * данные предыдущего пользователя или устаревшего запроса не показываются.
 * key = null — запрос не выполняется (состояние loading).
 */
export function useSessionQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const fullKey = key === null ? null : `${key}#${version}`;
  const [entry, setEntry] = useState<{ key: string; state: QueryState<T>; refreshError: string | null } | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (fullKey === null) return;
    let active = true;
    const base = fullKey.slice(0, fullKey.lastIndexOf('#') + 1);
    fetcherRef
      .current()
      .then((data) => {
        if (active) setEntry({ key: fullKey, state: { status: 'ready', data }, refreshError: null });
      })
      .catch((e: unknown) => {
        if (!active) return;
        const message = errorText(e);
        // Ошибка ФОНОВОГО обновления того же ключа: прежние данные остаются на экране (например, заполненный тест),
        // ошибка сообщается отдельно. Экран ошибки — только если данных ещё не было.
        setEntry((prev) =>
          prev && prev.key.startsWith(base) && prev.state.status === 'ready'
            ? { key: fullKey, state: prev.state, refreshError: message }
            : { key: fullKey, state: { status: 'error', message }, refreshError: null },
        );
      });
    return () => {
      active = false;
    };
  }, [fullKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Во время перезагрузки (тот же ключ, новая версия) показываем прежние готовые данные — без мигания.
  // Данные другого ключа (другой пользователь или параметры) не показываются никогда.
  const sameKey = entry !== null && key !== null && entry.key.startsWith(`${key}#`);
  let state: QueryState<T> = { status: 'loading' };
  if (entry && entry.key === fullKey) state = entry.state;
  else if (sameKey && entry.state.status === 'ready') state = entry.state;
  const refreshing = sameKey && entry.key !== fullKey;
  const refreshError = entry && entry.key === fullKey ? entry.refreshError : null;
  return { state, reload, refreshing, refreshError };
}

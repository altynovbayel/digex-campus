import { ArrowRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorText } from '../../api/client';
import { ATTEMPTS_PAGE_SIZE, fetchMyAttemptsPage } from '../../api/learning';
import { useCabinet } from '../../cabinet/useCabinet';
import { Alert } from '../../components/Alert';
import { ResultsTable } from '../../components/ResultsTable';
import type { AttemptRecord } from '../../types';

/** История своих попыток: первая страница из кабинета, остальные — по кнопке «Показать ещё». */
export function AttemptHistory() {
  const { user, results, stats, mode, dataKey, revision } = useCabinet();
  // Дополнительные страницы привязаны к сессии и версии данных кабинета: после обновления начинаем заново.
  const pageKey = `${dataKey}:${revision}`;
  const [extra, setExtra] = useState<{ key: string; rows: AttemptRecord[] }>({ key: pageKey, rows: [] });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const more = extra.key === pageKey ? extra.rows : [];
  const seen = new Set(results.map((r) => r.id));
  const rows = [...results, ...more.filter((r) => !seen.has(r.id))];
  const hasMore = mode === 'live' && rows.length < stats.attempts;

  const loadMore = async () => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const keyAtStart = pageKey;
    try {
      const page = await fetchMyAttemptsPage(user.id, rows.length);
      setExtra((prev) => (prev.key === keyAtStart ? { key: keyAtStart, rows: [...prev.rows, ...page] } : { key: keyAtStart, rows: page }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <ResultsTable
        rows={rows}
        caption="Мои результаты тестов"
        emptyText="Здесь появятся результаты твоего первого теста."
        emptyAction={
          <Link to="/learning" className="link">
            К урокам <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />
      {error && <Alert tone="error">{error}</Alert>}
      {hasMore && (
        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={loadMore} disabled={busy} aria-busy={busy}>
            {busy ? 'Загружаем…' : `Показать ещё (${Math.min(ATTEMPTS_PAGE_SIZE, stats.attempts - rows.length)})`}
          </button>
          <span className="muted small">
            Показано {rows.length} из {stats.attempts}
          </span>
        </div>
      )}
    </>
  );
}

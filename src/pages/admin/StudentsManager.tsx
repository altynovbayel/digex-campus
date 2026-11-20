import { CheckCircle2, RotateCcw, ShieldOff, Users } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { confirmPayment, revokeAccess, studentsOverview, type AdminPayment, type AdminStudent } from '../../api/admin';
import { errorText } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { RefreshNotice } from '../../components/RefreshNotice';
import { Field } from '../../components/Field';
import { AccessBadge, PeriodBadge } from '../../components/StatusBadges';
import { ACCESS_DAYS } from '../../lib/access';
import { formatDate, formatDateTime, formatSom } from '../../lib/format';
import { useSessionQuery } from '../../lib/useSessionQuery';
import type { AccessStatus } from '../../types';

/** Общий статус доступа к курсу: по последнему периоду; без оплат — не активирован. */
function accessStatus(student: AdminStudent): AccessStatus {
  return student.payments[0]?.status ?? 'not_activated';
}

const newRequestId = () => crypto.randomUUID();

function PaymentForm({ student, onDone }: { student: AdminStudent; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  // Ключ идемпотентности: один на попытку подтверждения. Повтор после сбоя сети отправляет тот же ключ,
  // и база не создаст вторую оплату. Новый ключ — после успеха или при изменении суммы.
  const [requestId, setRequestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки, в отличие от busy.
  const inFlight = useRef(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const active = accessStatus(student) === 'active';

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || inFlight.current) return;
    const normalized = amount.replace(/\s/g, '').replace(',', '.');
    const value = Number(normalized);
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || !(value > 0) || value > 10_000_000) {
      setAmountError('Укажите сумму в сомах больше нуля, не более двух знаков после запятой.');
      document.getElementById('pay-amount')?.focus();
      return;
    }
    setAmountError(null);
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const { replayed } = await confirmPayment(student.id, value, requestId);
      setMessage({
        tone: 'success',
        text: replayed
          ? 'Эта оплата уже была подтверждена ранее — повтор не создал новую запись.'
          : `Оплата подтверждена: оба раздела открыты на ${ACCESS_DAYS} дней.`,
      });
      setAmount('');
      setRequestId(newRequestId());
      onDone();
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <h3 className="admin-form__title">Подтвердить оплату курса</h3>
      <p className="muted small">
        Одна оплата открывает оба раздела. Доступ начнётся сейчас (время сервера) и закончится через {ACCESS_DAYS}{' '}
        суток. Пока действует текущий период, новую оплату подтвердить нельзя.
      </p>
      {active && <Alert tone="info">У ученика уже есть действующий доступ.</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Field
        id="pay-amount"
        label="Сумма, сом"
        inputMode="decimal"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setRequestId(newRequestId());
        }}
        error={amountError}
      />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
          <CheckCircle2 size={16} aria-hidden="true" /> {busy ? 'Подтверждаем…' : 'Подтвердить оплату'}
        </button>
      </div>
    </form>
  );
}

function PaymentHistory({ payments, onDone }: { payments: AdminPayment[]; onDone: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки, в отличие от busy.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = async (paymentId: string) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await revokeAccess(paymentId, reason.trim());
      setConfirming(null);
      setReason('');
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (payments.length === 0) return <p className="muted small">Оплат пока нет — доступ не активирован.</p>;

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="История оплат ученика">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Подтверждено</th>
              <th scope="col">Сумма</th>
              <th scope="col">Период доступа</th>
              <th scope="col">Статус</th>
              <th scope="col">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">{formatDateTime(p.confirmedAt)}</td>
                <td className="nowrap">{formatSom(p.amountSom)}</td>
                <td className="muted small">
                  {formatDateTime(p.startsAt)} — {formatDateTime(p.endsAt)}
                  {p.revokedAt && (
                    <div>
                      Отозван {formatDateTime(p.revokedAt)}
                      {p.revokeReason ? `: ${p.revokeReason}` : ''}
                    </div>
                  )}
                </td>
                <td>
                  <PeriodBadge status={p.status} />
                </td>
                <td>
                  {p.status === 'active' &&
                    (confirming === p.id ? (
                      <span className="confirm-inline" role="group" aria-label="Подтверждение отзыва">
                        <Field
                          id={`revoke-reason-${p.id}`}
                          label="Причина (необязательно)"
                          value={reason}
                          maxLength={500}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => revoke(p.id)}>
                          {busy ? 'Отзываем…' : 'Да, отозвать доступ'}
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setConfirming(null)}>
                          Отмена
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(p.id)}>
                        <ShieldOff size={16} aria-hidden="true" /> Отозвать
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function StudentsManager() {
  const { sessionKey } = useAuth();
  const overview = useSessionQuery(sessionKey ? `admin-students:${sessionKey}` : null, studentsOverview);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const students = overview.state.status === 'ready' ? overview.state.data : [];
  const selected = students.find((s) => s.id === selectedId) ?? null;
  const current = selected?.payments[0];

  return (
    <>
      {overview.state.status === 'error' && (
        <section className="card">
          <Alert tone="error">{overview.state.message}</Alert>
          <button type="button" className="btn btn--secondary" onClick={overview.reload}>
            <RotateCcw size={16} aria-hidden="true" /> Повторить
          </button>
        </section>
      )}

      {overview.refreshError && (
        <section className="card">
          <RefreshNotice error={overview.refreshError} onRetry={overview.reload} />
        </section>
      )}

      {selected && (
        <section className="card" aria-labelledby="student-title">
          <div className="card__head">
            <div>
              <h2 id="student-title" className="card__title">
                {selected.fullName}
              </h2>
              <p className="muted small">
                {selected.email ?? 'email не указан'} · зарегистрирован {formatDate(selected.createdAt)}
              </p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedId(null)}>
              Закрыть
            </button>
          </div>
          <div className="two-col">
            <div className="admin-form">
              <h3 className="admin-form__title">Доступ к курсу</h3>
              <dl className="info-list">
                <div>
                  <dt>Статус</dt>
                  <dd>
                    <AccessBadge status={accessStatus(selected)} />
                  </dd>
                </div>
                <div>
                  <dt>Начало</dt>
                  <dd>{formatDateTime(current?.startsAt ?? null)}</dd>
                </div>
                <div>
                  <dt>Окончание</dt>
                  <dd>{formatDateTime(current?.endsAt ?? null)}</dd>
                </div>
              </dl>
            </div>
            <PaymentForm key={`p-${selected.id}`} student={selected} onDone={overview.reload} />
          </div>
          <h3 className="admin-form__title">История оплат</h3>
          <PaymentHistory payments={selected.payments} onDone={overview.reload} />
        </section>
      )}

      <section className="card" aria-labelledby="users-title" aria-busy={overview.state.status === 'loading'}>
        <h2 id="users-title" className="card__title">
          Зарегистрированные пользователи
        </h2>
        {overview.state.status === 'loading' && (
          <p className="loading-row" role="status">
            Загружаем…
          </p>
        )}
        {overview.state.status === 'ready' &&
          (students.length === 0 ? (
            <EmptyState icon={Users} title="Пользователей пока нет" />
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Пользователи">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Пользователь</th>
                    <th scope="col">Доступ к курсу</th>
                    <th scope="col">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className={s.id === selectedId ? 'is-selected' : undefined}>
                      <td>
                        <strong>{s.fullName}</strong> {s.role === 'admin' && <Badge tone="accent">Администратор</Badge>}
                        <div className="muted small">{s.email ?? '—'}</div>
                      </td>
                      <td>
                        <span className="access-list__head">
                          <AccessBadge status={accessStatus(s)} />
                          {s.payments[0]?.status === 'active' && (
                            <span className="muted small">до {formatDateTime(s.payments[0].endsAt)}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setSelectedId(s.id)}
                          aria-pressed={s.id === selectedId}
                        >
                          Управлять
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>
    </>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { SetupNotice } from '../../components/SetupNotice';
import { validateEmail } from '../../lib/validation';
import { SubmitButton } from './AuthExtras';

export function ForgotPasswordPage() {
  const { state, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const unconfigured = state.status === 'unconfigured' ? state.problem : null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || unconfigured) return;
    const v = validateEmail(email);
    setError(v);
    if (v) {
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const { error: err } = await requestPasswordReset(email);
    setBusy(false);
    if (err) setServerError(err);
    else setSent(true);
  };

  return (
    <div className="auth auth--narrow">
      <div className="auth__top">
        <Logo to="/login" />
      </div>
      <section className="card auth__card" aria-labelledby="forgot-title">
        <h1 id="forgot-title" className="auth__card-title">
          Восстановление пароля
        </h1>
        {sent ? (
          <>
            <Alert tone="success">
              <p>
                Если аккаунт с адресом <strong>{email.trim()}</strong> существует, мы отправили на него ссылку для
                смены пароля. Проверьте также папку «Спам».
              </p>
            </Alert>
            <Link to="/login" className="btn btn--secondary btn--block">
              Вернуться ко входу
            </Link>
          </>
        ) : (
          <>
            <p className="muted">Укажите email — пришлём ссылку для создания нового пароля.</p>
            {unconfigured && <SetupNotice problem={unconfigured} />}
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <form className="form" onSubmit={onSubmit} noValidate aria-busy={busy}>
              <Field
                id="forgot-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  setServerError(null);
                }}
                error={error}
              />
              <SubmitButton busy={busy} label="Отправить ссылку" busyLabel="Отправляем…" unavailable={Boolean(unconfigured)} />
            </form>
            <p className="auth__switch">
              <Link to="/login">Вернуться ко входу</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { SetupNotice } from '../../components/SetupNotice';
import { validateEmail } from '../../lib/validation';
import { DemoLink, SubmitButton } from './AuthExtras';

interface Errors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { state, signIn, resendConfirmation, linkError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendInfo, setResendInfo] = useState<{ text: string; error: boolean } | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const unconfigured = state.status === 'unconfigured' ? state.problem : null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || unconfigured) return;
    const next: Errors = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    if (!password) next.password = 'Введите пароль.';
    setErrors(next);
    if (next.email || next.password) {
      document.getElementById(next.email ? 'login-email' : 'login-password')?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    setResendInfo(null);
    const { error, unconfirmed: notConfirmed } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setServerError(error);
      setUnconfirmed(notConfirmed);
      setPassword('');
    }
    // При успехе GuestOnly перенаправит в кабинет.
  };

  const onResend = async () => {
    setResendBusy(true);
    const { error } = await resendConfirmation(email);
    setResendBusy(false);
    setResendInfo({ text: error ?? 'Письмо для подтверждения отправлено повторно.', error: Boolean(error) });
  };

  return (
    <div className="auth auth--narrow">
      <div className="auth__top">
        <Logo to="/login" />
      </div>
      <section className="card auth__card" aria-labelledby="login-title">
        <h1 id="login-title" className="auth__card-title">
          Вход
        </h1>
        <p className="muted">Рады видеть вас снова.</p>

        {unconfigured && <SetupNotice problem={unconfigured} />}
        {linkError && <Alert tone="error">{linkError}</Alert>}
        {serverError && <Alert tone="error">{serverError}</Alert>}
        {unconfirmed && (
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={onResend}
            disabled={resendBusy}
            aria-busy={resendBusy}
          >
            {resendBusy ? 'Отправляем…' : 'Отправить письмо ещё раз'}
          </button>
        )}
        {resendInfo && <Alert tone={resendInfo.error ? 'error' : 'success'}>{resendInfo.text}</Alert>}

        <form className="form" onSubmit={onSubmit} noValidate aria-busy={busy}>
          <Field
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined }));
              setServerError(null);
              setUnconfirmed(false);
            }}
            error={errors.email}
          />
          <Field
            id="login-password"
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((p) => ({ ...p, password: undefined }));
              setServerError(null);
            }}
            error={errors.password}
          />
          <p className="auth__forgot">
            <Link to="/forgot-password">Забыли пароль?</Link>
          </p>
          <SubmitButton busy={busy} label="Войти" busyLabel="Входим…" unavailable={Boolean(unconfigured)} />
        </form>

        <p className="auth__switch">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
        <DemoLink />
      </section>
    </div>
  );
}

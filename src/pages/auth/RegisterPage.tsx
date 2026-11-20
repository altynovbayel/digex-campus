import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { SetupNotice } from '../../components/SetupNotice';
import { VideoBlock } from '../../components/VideoBlock';
import { courseInfo } from '../../data/course';
import { MIN_PASSWORD_LENGTH, validateEmail, validateName, validateNewPassword } from '../../lib/validation';
import { DemoLink, SubmitButton } from './AuthExtras';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { name: '', email: '', password: '', confirm: '' };

function validate(v: FormState): Errors {
  const errors: Errors = {};
  const name = validateName(v.name);
  const email = validateEmail(v.email);
  const password = validateNewPassword(v.password);
  if (name) errors.name = name;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (!v.confirm) errors.confirm = 'Повторите пароль.';
  else if (v.confirm !== v.password) errors.confirm = 'Пароли не совпадают.';
  return errors;
}

export function RegisterPage() {
  const { state, signUp, resendConfirmation } = useAuth();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resend, setResend] = useState<{ busy: boolean; message: string | null; error: boolean }>({
    busy: false,
    message: null,
    error: false,
  });

  const unconfigured = state.status === 'unconfigured' ? state.problem : null;

  const update = (key: keyof FormState) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || unconfigured) return;
    const next = validate(values);
    setErrors(next);
    const firstInvalid = (Object.keys(next) as (keyof FormState)[])[0];
    if (firstInvalid) {
      document.getElementById(`reg-${firstInvalid}`)?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const result = await signUp(values.name, values.email, values.password);
    setBusy(false);
    if (result.error !== null) {
      setServerError(result.error);
      return;
    }
    // Пароли не храним в состоянии дольше необходимого.
    setValues((prev) => ({ ...prev, password: '', confirm: '' }));
    // Если подтверждение email отключено, пользователь уже вошёл — GuestOnly перенаправит в кабинет.
    if (result.needsConfirmation) setSentTo(values.email.trim());
  };

  const onResend = async () => {
    if (!sentTo) return;
    setResend({ busy: true, message: null, error: false });
    const { error } = await resendConfirmation(sentTo);
    setResend({ busy: false, message: error ?? 'Письмо отправлено повторно.', error: Boolean(error) });
  };

  return (
    <div className="auth">
      <div className="auth__top">
        <Logo to="/register" />
      </div>
      <div className="auth__grid">
        <section className="auth__intro" aria-labelledby="intro-title">
          <p className="eyebrow">Добро пожаловать</p>
          <h1 id="intro-title" className="auth__title">
            {courseInfo.tagline}
          </h1>
          <p className="muted">
            В вводном видео — о двух направлениях, Claude и ChatGPT, о том, как устроена платформа, как проходят
            уроки и тесты и сколько действует доступ.
          </p>
          <VideoBlock url={courseInfo.introVideoUrl} title="Вводное видео о курсе" />
        </section>

        <section className="card auth__card" aria-labelledby="register-title">
          {sentTo ? (
            <>
              <span className="locked__icon" aria-hidden="true">
                <MailCheck size={26} />
              </span>
              <h2 id="register-title" className="auth__card-title">
                Проверьте почту
              </h2>
              <p>
                Мы отправили письмо на <strong>{sentTo}</strong>. Откройте ссылку из письма, чтобы подтвердить email
                и войти в кабинет.
              </p>
              <p className="muted small">
                Если письма нет, проверьте папку «Спам». Если аккаунт с этим email уже существует, войдите или
                восстановите пароль.
              </p>
              {resend.message && <Alert tone={resend.error ? 'error' : 'success'}>{resend.message}</Alert>}
              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={onResend}
                disabled={resend.busy}
                aria-busy={resend.busy}
              >
                {resend.busy ? 'Отправляем…' : 'Отправить письмо ещё раз'}
              </button>
              <p className="auth__switch">
                <Link to="/login">Перейти ко входу</Link>
              </p>
            </>
          ) : (
            <>
              <h2 id="register-title" className="auth__card-title">
                Регистрация
              </h2>
              <p className="muted">Создайте аккаунт, чтобы начать обучение.</p>

              {unconfigured && <SetupNotice problem={unconfigured} />}
              {serverError && <Alert tone="error">{serverError}</Alert>}

              <form className="form" onSubmit={onSubmit} noValidate aria-busy={busy}>
                <Field
                  id="reg-name"
                  label="Имя"
                  autoComplete="name"
                  maxLength={100}
                  value={values.name}
                  onChange={(e) => update('name')(e.target.value)}
                  error={errors.name}
                />
                <Field
                  id="reg-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={values.email}
                  onChange={(e) => update('email')(e.target.value)}
                  error={errors.email}
                />
                <Field
                  id="reg-password"
                  label="Пароль"
                  type="password"
                  autoComplete="new-password"
                  hint={`Минимум ${MIN_PASSWORD_LENGTH} символов.`}
                  value={values.password}
                  onChange={(e) => update('password')(e.target.value)}
                  error={errors.password}
                />
                <Field
                  id="reg-confirm"
                  label="Повторите пароль"
                  type="password"
                  autoComplete="new-password"
                  value={values.confirm}
                  onChange={(e) => update('confirm')(e.target.value)}
                  error={errors.confirm}
                />
                <SubmitButton
                  busy={busy}
                  label="Зарегистрироваться"
                  busyLabel="Создаём аккаунт…"
                  unavailable={Boolean(unconfigured)}
                />
              </form>

              <p className="auth__switch">
                Уже есть аккаунт? <Link to="/login">Войти</Link>
              </p>
              <DemoLink />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

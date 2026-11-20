import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { FullPageLoader } from '../../components/FullPageState';
import { Logo } from '../../components/Logo';
import { SetupNotice } from '../../components/SetupNotice';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../lib/validation';
import { SubmitButton } from './AuthExtras';

/** Новый пароль после перехода по ссылке из письма восстановления. */
export function ResetPasswordPage() {
  const { state, recovery, updatePassword, finishRecovery, linkError } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return <FullPageLoader />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const next: { password?: string; confirm?: string } = {};
    const p = validateNewPassword(password);
    if (p) next.password = p;
    if (!confirm) next.confirm = 'Повторите пароль.';
    else if (confirm !== password) next.confirm = 'Пароли не совпадают.';
    setErrors(next);
    if (next.password || next.confirm) {
      document.getElementById(next.password ? 'reset-password' : 'reset-confirm')?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setServerError(error);
      return;
    }
    setPassword('');
    setConfirm('');
    finishRecovery();
    navigate('/', { replace: true });
  };

  return (
    <div className="auth auth--narrow">
      <div className="auth__top">
        <Logo to="/login" />
      </div>
      <section className="card auth__card" aria-labelledby="reset-title">
        <h1 id="reset-title" className="auth__card-title">
          Новый пароль
        </h1>

        {state.status === 'unconfigured' && <SetupNotice problem={state.problem} />}

        {/* Ошибка ссылки важнее текущей сессии: недействительная ссылка не должна выглядеть рабочей. */}
        {(linkError || state.status === 'signed_out') && (
          <>
            <Alert tone="error">
              {linkError ?? 'Ссылка для смены пароля недействительна или устарела. Запросите новую.'}
            </Alert>
            {state.status === 'signed_in' ? (
              <p className="muted small">
                Вы уже вошли в аккаунт {state.user.email}. Чтобы сменить пароль, выйдите и запросите новую ссылку
                на странице «Забыли пароль?».
              </p>
            ) : (
              <Link to="/forgot-password" className="btn btn--primary btn--block">
                Запросить новую ссылку
              </Link>
            )}
          </>
        )}

        {/* Вход без ссылки восстановления: форму смены пароля не показываем. */}
        {!linkError && state.status === 'signed_in' && !recovery && (
          <>
            <Alert tone="info">
              Эта страница открывается по ссылке из письма восстановления пароля. Смена пароля из профиля появится позже.
            </Alert>
            <Link to="/" className="btn btn--secondary btn--block">
              В кабинет
            </Link>
          </>
        )}

        {!linkError && state.status === 'signed_in' && recovery && (
          <>
            <p className="muted">Придумайте новый пароль для аккаунта {state.user.email}.</p>
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <form className="form" onSubmit={onSubmit} noValidate aria-busy={busy}>
              <Field
                id="reset-password"
                label="Новый пароль"
                type="password"
                autoComplete="new-password"
                hint={`Минимум ${MIN_PASSWORD_LENGTH} символов.`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((x) => ({ ...x, password: undefined }));
                }}
                error={errors.password}
              />
              <Field
                id="reset-confirm"
                label="Повторите пароль"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors((x) => ({ ...x, confirm: undefined }));
                }}
                error={errors.confirm}
              />
              <SubmitButton busy={busy} label="Сохранить пароль" busyLabel="Сохраняем…" />
            </form>
          </>
        )}
      </section>
    </div>
  );
}

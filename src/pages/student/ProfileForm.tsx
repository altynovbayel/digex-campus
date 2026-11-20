import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { PendingAction } from '../../components/PendingAction';
import { validateName } from '../../lib/validation';

interface Props {
  name: string;
  email: string;
  demo: boolean;
}

/** Редактирование имени. Роль и email здесь не меняются (роль защищена в базе). */
export function ProfileForm({ name, email, demo }: Props) {
  const { updateName } = useAuth();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (demo || busy) return;
    const v = validateName(value) ?? (value.trim().length > 100 ? 'Имя должно быть не длиннее 100 символов.' : null);
    setError(v);
    setResult(null);
    if (v) {
      document.getElementById('profile-name')?.focus();
      return;
    }
    setBusy(true);
    try {
      const { error: err, stale } = await updateName(value);
      // Ответ прошлой сессии: форма этой сессии уже пересоздана, сообщения не показываем.
      if (stale) return;
      setResult(err ? { tone: 'error', text: err } : { tone: 'success', text: 'Имя сохранено.' });
    } catch {
      setResult({ tone: 'error', text: 'Не удалось сохранить имя. Попробуйте ещё раз.' });
    } finally {
      setBusy(false);
    }
  };

  const unchanged = value.trim() === name.trim();

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <Field
        id="profile-name"
        label="Имя"
        autoComplete="name"
        maxLength={100}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
          setResult(null);
        }}
        error={error}
      />
      <Field id="profile-email" label="Email" type="email" value={email} readOnly hint="Смена email появится позже." />
      {result && <Alert tone={result.tone}>{result.text}</Alert>}
      <div className="form__actions">
        {demo ? (
          <PendingAction label="Сохранить" icon={Save} variant="primary" reason="В демо-режиме изменения не сохраняются" />
        ) : (
          <button type="submit" className="btn btn--primary" disabled={busy || unchanged} aria-busy={busy}>
            <Save size={16} aria-hidden="true" />
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        )}
      </div>
    </form>
  );
}

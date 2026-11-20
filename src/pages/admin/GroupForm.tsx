import { useRef, useState, type FormEvent } from 'react';
import { createGroup, updateGroup, type AdminGroup } from '../../api/admin';
import { errorText } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { TextAreaField } from '../../components/TextAreaField';

interface Props {
  group: AdminGroup | null;
  onSaved: () => void;
  onCancel: () => void;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Создание (group = null) или редактирование раздела курса. Идентификатор задаётся один раз. */
export function GroupForm({ group, onSaved, onCancel }: Props) {
  const [id, setId] = useState(group?.id ?? '');
  const [title, setTitle] = useState(group?.title ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(group?.sortOrder ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки, в отличие от busy.
  const inFlight = useRef(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || inFlight.current) return;
    const next: Record<string, string> = {};
    if (!group && !ID_RE.test(id.trim())) next.id = 'От 2 до 40 символов: строчные латинские буквы, цифры и дефис.';
    if (!title.trim() || title.trim().length > 100) next.title = 'Название: от 1 до 100 символов.';
    if (description.length > 500) next.description = 'Не более 500 символов.';
    const order = Number(sortOrder);
    if (!Number.isInteger(order)) next.sortOrder = 'Целое число.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      const input = { title: title.trim(), description: description.trim(), sortOrder: order };
      if (group) await updateGroup(group.id, input);
      else await createGroup(id.trim(), input);
      onSaved();
    } catch (err) {
      setServerError(errorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <h3 className="admin-form__title">{group ? `Раздел «${group.title}»` : 'Новый раздел'}</h3>
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <Field
        id="group-id"
        label="Идентификатор"
        value={id}
        onChange={(e) => setId(e.target.value)}
        readOnly={Boolean(group)}
        hint={group ? 'Идентификатор не меняется.' : 'Например: claude. Латиница, цифры, дефис. Изменить потом нельзя.'}
        error={errors.id}
      />
      <Field id="group-title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} error={errors.title} />
      <TextAreaField
        id="group-description"
        label="Описание"
        rows={2}
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      <Field
        id="group-order"
        label="Порядок в списке"
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        error={errors.sortOrder}
      />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </form>
  );
}

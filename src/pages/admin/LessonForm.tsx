import { useRef, useState, type FormEvent } from 'react';
import { createLesson, updateLesson, type AdminLesson } from '../../api/admin';
import { errorText } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { TextAreaField } from '../../components/TextAreaField';
import { parseYouTubeId } from '../../lib/validation';

interface Props {
  groupId: string;
  lesson: AdminLesson | null;
  nextPosition: number;
  onSaved: () => void;
  onCancel: () => void;
}

/** Создание (lesson = null) или редактирование урока. Простые поля и textarea. */
export function LessonForm({ groupId, lesson, nextPosition, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [position, setPosition] = useState(String(lesson?.position ?? nextPosition));
  const [goal, setGoal] = useState(lesson?.goal ?? '');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [examplePrompt, setExamplePrompt] = useState(lesson?.examplePrompt ?? '');
  const [task, setTask] = useState(lesson?.task ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtubeUrl ?? '');
  const [published, setPublished] = useState(lesson?.published ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки, в отличие от busy.
  const inFlight = useRef(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || inFlight.current) return;
    const next: Record<string, string> = {};
    if (!title.trim() || title.trim().length > 200) next.title = 'Название: от 1 до 200 символов.';
    const pos = Number(position);
    if (!Number.isInteger(pos) || pos < 1 || pos > 10000) next.position = 'Целое число от 1 до 10000.';
    const url = youtubeUrl.trim();
    const videoId = url ? parseYouTubeId(url) : null;
    if (url && !videoId) next.youtubeUrl = 'Нужна ссылка на видео YouTube, например https://youtu.be/xxxxxxxxxxx';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.getElementById(`lesson-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      const input = {
        title: title.trim(),
        position: pos,
        goal: goal.trim(),
        content: content.trim(),
        examplePrompt: examplePrompt.trim(),
        task: task.trim(),
        // Сохраняем каноническую ссылку: её формат принимает проверка в базе.
        youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        published,
      };
      if (lesson) await updateLesson(lesson.id, input);
      else await createLesson(groupId, input);
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
      <h3 className="admin-form__title">{lesson ? `Урок «${lesson.title}»` : 'Новый урок'}</h3>
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <Field id="lesson-title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} error={errors.title} />
      <Field
        id="lesson-position"
        label="Порядок"
        type="number"
        min={1}
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        error={errors.position}
      />
      <TextAreaField id="lesson-goal" label="Цель урока" rows={2} maxLength={1000} value={goal} onChange={(e) => setGoal(e.target.value)} />
      <TextAreaField
        id="lesson-content"
        label="Текст урока"
        rows={10}
        maxLength={50000}
        hint="Абзацы разделяйте пустой строкой."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <TextAreaField
        id="lesson-prompt"
        label="Пример запроса"
        rows={3}
        maxLength={5000}
        value={examplePrompt}
        onChange={(e) => setExamplePrompt(e.target.value)}
      />
      <TextAreaField id="lesson-task" label="Практическое задание" rows={3} maxLength={5000} value={task} onChange={(e) => setTask(e.target.value)} />
      <Field
        id="lesson-youtubeUrl"
        label="Ссылка на YouTube (необязательно)"
        type="url"
        placeholder="https://www.youtube.com/watch?v=…"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        hint="Без ссылки ученики увидят «Видео скоро появится»."
        error={errors.youtubeUrl}
      />
      <label className="checkbox" htmlFor="lesson-published">
        <input id="lesson-published" type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Опубликован (виден ученикам с активным доступом)
      </label>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить урок'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </form>
  );
}

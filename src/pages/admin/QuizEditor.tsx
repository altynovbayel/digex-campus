import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  addQuestion,
  createQuiz,
  deleteQuestion,
  getLessonQuiz,
  moveQuestion,
  setQuizPublished,
  updateQuestion,
  type AdminLesson,
  type AdminQuestion,
  type QuestionInput,
} from '../../api/admin';
import { errorText } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { RefreshNotice } from '../../components/RefreshNotice';
import { TextAreaField } from '../../components/TextAreaField';
import { useSessionQuery } from '../../lib/useSessionQuery';

const LETTERS = ['А', 'Б', 'В', 'Г'] as const;

/** Действие с блокировкой (в том числе от двойного нажатия до перерисовки) и показом ошибки. */
function useGuarded(onDone: () => void, onFail: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  // Итог последней записи: от него зависит текст уведомления о неудачном перечитывании.
  const [lastFailed, setLastFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Ответ, пришедший после закрытия редактора (или открытия другого теста — компонент пересоздаётся по ключу),
  // не трогает состояние и не запускает перезагрузку.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busy || inFlight.current) return false;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    try {
      await action();
      if (alive.current) {
        setLastFailed(false);
        onDone();
      }
      return alive.current;
    } catch (e) {
      if (alive.current) {
        setError(errorText(e));
        setLastFailed(true);
        // Исход записи неизвестен (например, ответ потерян по сети, а база изменение сохранила):
        // перечитываем тест — до успешного обновления действия, зависящие от порядка, заблокированы.
        onFail();
      }
      return false;
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };
  return { busy, error, run, setError, lastFailed };
}

function QuestionForm({
  question,
  onSubmit,
  onCancel,
  busy,
}: {
  question: AdminQuestion | null;
  onSubmit: (input: QuestionInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const idp = question?.id ?? 'new';
  const [text, setText] = useState(question?.text ?? '');
  const [options, setOptions] = useState<[string, string, string, string]>(question?.options ?? ['', '', '', '']);
  const [correct, setCorrect] = useState<number | null>(question?.correctIndex ?? null);
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: string[] = [];
    if (!text.trim()) next.push('Введите текст вопроса.');
    if (options.some((o) => !o.trim())) next.push('Заполните все четыре варианта ответа.');
    if (correct === null) next.push('Выберите правильный вариант.');
    setErrors(next);
    if (next.length > 0 || correct === null) return;
    onSubmit({
      text: text.trim(),
      options: [options[0].trim(), options[1].trim(), options[2].trim(), options[3].trim()],
      correctIndex: correct,
    });
  };

  return (
    <form className="form admin-form" onSubmit={submit} noValidate aria-busy={busy}>
      <h4 className="admin-form__title">{question ? 'Изменить вопрос' : 'Новый вопрос'}</h4>
      <fieldset className="form-fieldset" disabled={busy}>
      {errors.length > 0 && (
        <Alert tone="error">
          {errors.map((er) => (
            <p key={er}>{er}</p>
          ))}
        </Alert>
      )}
      <TextAreaField id={`q-text-${idp}`} label="Вопрос" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      <fieldset className="quiz-options-edit">
        <legend className="field__label">Варианты ответа (отметьте правильный)</legend>
        {options.map((opt, i) => (
          <div key={i} className="quiz-option-edit">
            <input
              type="radio"
              id={`q-correct-${idp}-${i}`}
              name={`q-correct-${idp}`}
              checked={correct === i}
              onChange={() => setCorrect(i)}
              aria-label={`Вариант ${LETTERS[i]} — правильный`}
            />
            <label className="sr-only" htmlFor={`q-opt-${idp}-${i}`}>
              Вариант {LETTERS[i]}
            </label>
            <input
              id={`q-opt-${idp}-${i}`}
              className="input"
              maxLength={500}
              placeholder={`Вариант ${LETTERS[i]}`}
              value={opt}
              onChange={(e) =>
                setOptions((prev) => {
                  const next: [string, string, string, string] = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
            />
          </div>
        ))}
      </fieldset>
      </fieldset>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить вопрос'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </form>
  );
}

/** Редактор теста урока. Вопросы с правильными ответами доступны только администратору (RLS). */
export function QuizEditor({ lesson, onClose }: { lesson: AdminLesson; onClose: () => void }) {
  const { sessionKey } = useAuth();
  const { state, reload, refreshing, refreshError } = useSessionQuery(sessionKey ? `admin-quiz:${sessionKey}:${lesson.id}` : null, () =>
    getLessonQuiz(lesson.id),
  );
  const [form, setForm] = useState<{ question: AdminQuestion | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const action = useGuarded(
    () => {
      setConfirmDelete(null);
      reload();
    },
    reload,
  );

  const quiz = state.status === 'ready' ? state.data : null;
  // Порядок на экране может быть устаревшим, пока список перечитывается после изменения (или перечитать не удалось):
  // перестановка «выше/ниже» относительно устаревшего соседа дала бы не тот результат. Повтор — в RefreshNotice.
  const orderStale = refreshing || refreshError !== null;

  return (
    <section className="card" aria-labelledby="quiz-editor-title">
      <div className="card__head">
        <div>
          <h2 id="quiz-editor-title" className="card__title">
            Тест к уроку «{lesson.title}»
          </h2>
          {quiz && (
            <p className="group-panel__status">
              {quiz.published ? <Badge tone="success">Опубликован</Badge> : <Badge tone="warning">Не опубликован</Badge>}
              <span className="muted small">
                Вопросов: {quiz.questions.length} · версия {quiz.version}
              </span>
            </p>
          )}
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          <X size={16} aria-hidden="true" /> Закрыть
        </button>
      </div>

      {action.error && <Alert tone="error">{action.error}</Alert>}
      <RefreshNotice error={refreshError} onRetry={reload} saved={!action.lastFailed} />

      {state.status === 'loading' && (
        <p className="loading-row" role="status">
          Загружаем тест…
        </p>
      )}
      {state.status === 'error' && (
        <>
          <Alert tone="error">{state.message}</Alert>
          <button type="button" className="btn btn--secondary" onClick={reload}>
            <RotateCcw size={16} aria-hidden="true" /> Повторить
          </button>
        </>
      )}

      {state.status === 'ready' && !quiz && (
        <EmptyState
          icon={Plus}
          title="У этого урока пока нет теста"
          action={
            <button
              type="button"
              className="btn btn--primary"
              disabled={action.busy !== null}
              onClick={() => action.run('create', () => createQuiz(lesson.id))}
            >
              <Plus size={16} aria-hidden="true" /> Создать тест
            </button>
          }
        />
      )}

      {quiz && (
        <>
          <div className="form__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={action.busy !== null}
              onClick={() => action.run('publish', () => setQuizPublished(quiz.id, !quiz.published))}
            >
              {quiz.published ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {quiz.published ? 'Снять с публикации' : 'Опубликовать тест'}
            </button>
            {!form && (
              <button type="button" className="btn btn--ghost" disabled={action.busy !== null} onClick={() => setForm({ question: null })}>
                <Plus size={16} aria-hidden="true" /> Добавить вопрос
              </button>
            )}
          </div>
          <p className="muted small">
            Изменение вопросов не меняет уже сохранённые результаты учеников. Ученикам, которые проходят тест в этот момент,
            будет предложено загрузить его заново.
          </p>

          {form && (
            <QuestionForm
              key={form.question?.id ?? 'new'}
              question={form.question}
              busy={action.busy === 'save'}
              onCancel={() => setForm(null)}
              onSubmit={async (input) => {
                const formKey = form.question?.id ?? 'new';
                const saved = await action.run('save', () =>
                  form.question
                    ? updateQuestion(form.question.id, input)
                    : addQuestion(quiz.id, input),
                );
                // Закрываем только ту форму, для которой завершился запрос.
                if (saved) setForm((prev) => ((prev?.question?.id ?? 'new') === formKey ? null : prev));
              }}
            />
          )}

          {quiz.questions.length === 0 ? (
            <EmptyState icon={Plus} title="Вопросов пока нет" text="Пустой тест опубликовать нельзя." />
          ) : (
            <ol className="quiz-admin-list">
              {quiz.questions.map((q, i) => (
                <li key={q.id} className="quiz-admin-item">
                  <div className="quiz-admin-item__head">
                    <strong>
                      {i + 1}. {q.text}
                    </strong>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        aria-label={`Выше: вопрос ${i + 1}`}
                        disabled={action.busy !== null || orderStale || i === 0}
                        onClick={() => action.run(`up:${q.id}`, () => moveQuestion(q.id, -1, quiz.version))}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        aria-label={`Ниже: вопрос ${i + 1}`}
                        disabled={action.busy !== null || orderStale || i === quiz.questions.length - 1}
                        onClick={() => action.run(`down:${q.id}`, () => moveQuestion(q.id, 1, quiz.version))}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={action.busy !== null}
                        onClick={() => setForm({ question: q })}
                      >
                        <Pencil size={16} aria-hidden="true" /> Изменить
                      </button>
                      {confirmDelete === q.id ? (
                        <span className="confirm-inline" role="group" aria-label="Подтверждение удаления">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            disabled={action.busy !== null}
                            onClick={() => action.run(`del:${q.id}`, () => deleteQuestion(q.id))}
                          >
                            Да, удалить
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(null)}>
                            Отмена
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(q.id)}>
                          <Trash2 size={16} aria-hidden="true" /> Удалить
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="quiz-admin-options">
                    {q.options.map((o, oi) => (
                      <li key={oi} className={oi === q.correctIndex ? 'is-correct' : undefined}>
                        {LETTERS[oi]}. {o}
                        {oi === q.correctIndex && <Badge tone="success">верный</Badge>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

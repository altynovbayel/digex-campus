import { CircleCheck, ClipboardList, RotateCcw } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError, errorText } from '../../api/client';
import { fetchQuiz, submitQuizAttempt } from '../../api/learning';
import { useCabinet } from '../../cabinet/useCabinet';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { pluralize } from '../../lib/format';
import { useSessionQuery } from '../../lib/useSessionQuery';
import type { AttemptRecord, QuizForTaking } from '../../types';

const newRequestId = () => crypto.randomUUID();

/** Форма прохождения. Оценку считает база; клиент отправляет только выбранные варианты. */
function QuizForm({ quiz, onReload }: { quiz: QuizForTaking; onReload: () => void }) {
  const { reload: reloadCabinet } = useCabinet();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // Ключ идемпотентности одной попытки: повтор после сбоя сети не создаст вторую попытку.
  const [requestId, setRequestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки.
  const inFlight = useRef(false);
  const [error, setError] = useState<{ text: string; changed: boolean } | null>(null);
  const [result, setResult] = useState<AttemptRecord | null>(null);

  const missing = quiz.questions.filter((q) => answers[q.id] === undefined).length;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || inFlight.current) return;
    if (missing > 0) {
      setError({ text: `Ответьте на все вопросы. Без ответа: ${missing}.`, changed: false });
      const first = quiz.questions.find((q) => answers[q.id] === undefined);
      if (first) document.getElementById(`${first.id}-0`)?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { attempt } = await submitQuizAttempt(
        quiz.quizId,
        quiz.version,
        quiz.questions.map((q) => ({ questionId: q.id, optionIndex: answers[q.id] ?? -1 })),
        requestId,
      );
      setResult(attempt);
      reloadCabinet();
    } catch (err) {
      // Ответы не сбрасываем: можно отправить ещё раз тем же запросом (без дубля).
      const code = err instanceof ApiError ? err.code : null;
      setError({ text: errorText(err), changed: code === 'quiz_changed' });
      // Доступ закончился или отозван — обновляем кабинет, страница покажет причину.
      if (code === 'access_required') reloadCabinet();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const again = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setRequestId(newRequestId());
  };

  if (result) {
    return (
      <div className="quiz__result" role="status">
        <p>
          <CircleCheck size={18} aria-hidden="true" />{' '}
          <strong>
            Верных ответов: {result.correct} из {result.total} — {result.percent}%
          </strong>
        </p>
        <p className="muted">Результат сохранён в профиле. Тест можно пройти ещё раз — новая попытка сохранится отдельно.</p>
        <button type="button" className="btn btn--secondary" onClick={again}>
          <RotateCcw size={16} aria-hidden="true" /> Пройти ещё раз
        </button>
      </div>
    );
  }

  return (
    <form className="quiz" onSubmit={onSubmit} noValidate aria-busy={busy}>
      {quiz.questions.map((q, qi) => (
        <fieldset key={q.id} className="quiz__question" disabled={busy}>
          <legend>
            <span className="quiz__num">Вопрос {qi + 1}</span>
            {q.text}
          </legend>
          <div className="quiz__options">
            {q.options.map((opt, oi) => {
              const id = `${q.id}-${oi}`;
              const chosen = answers[q.id] === oi;
              return (
                <label key={id} htmlFor={id} className={`option${chosen ? ' option--chosen' : ''}`}>
                  <input
                    id={id}
                    type="radio"
                    name={q.id}
                    checked={chosen}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: oi }));
                      setError(null);
                      setRequestId(newRequestId());
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error && (
        <Alert tone="error">
          <p>{error.text}</p>
          {error.changed && (
            <p>
              <button type="button" className="btn btn--secondary btn--sm" onClick={onReload}>
                <RotateCcw size={16} aria-hidden="true" /> Загрузить тест заново
              </button>
            </p>
          )}
        </Alert>
      )}

      <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
        {busy ? 'Проверяем…' : 'Отправить ответы'}
      </button>
      {missing > 0 && !error && (
        <p className="muted small">
          Осталось ответить: {missing} {pluralize(missing, ['вопрос', 'вопроса', 'вопросов'])}.
        </p>
      )}
    </form>
  );
}

/** Тест к уроку из базы. Ключ запроса привязан к сессии и состоянию доступа: данные прежнего пользователя не показываются. */
export function LessonQuiz({ lessonId }: { lessonId: string }) {
  const { dataKey, access } = useCabinet();
  const { state, reload } = useSessionQuery(`quiz:${dataKey}:${lessonId}:${access.status}:${access.endsAt ?? ''}`, () =>
    fetchQuiz(lessonId),
  );

  if (state.status === 'loading') {
    return (
      <p className="loading-row" role="status">
        Загружаем тест…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <Alert tone="error">{state.message}</Alert>
        <button type="button" className="btn btn--secondary" onClick={reload}>
          <RotateCcw size={16} aria-hidden="true" /> Повторить
        </button>
      </>
    );
  }
  if (state.data.status !== 'ready') {
    return (
      <EmptyState
        icon={ClipboardList}
        title={state.data.status === 'no_access' ? 'Тест доступен при действующем доступе к курсу' : 'Тест к уроку пока недоступен'}
      />
    );
  }
  // Новая версия теста — новая форма (ответы прошлой версии не переносятся).
  return <QuizForm key={`${state.data.quiz.quizId}:${state.data.quiz.version}`} quiz={state.data.quiz} onReload={reload} />;
}

import { CircleCheck, CircleX, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { QuizQuestion } from '../types';

interface Props {
  questions: QuizQuestion[];
}

/**
 * Тест: четыре варианта, один правильный.
 * В демо проверка идёт в браузере и результат не сохраняется.
 * В рабочей версии ответы будут проверяться на сервере.
 */
export function Quiz({ questions }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const missing = questions.filter((q) => answers[q.id] === undefined);
    if (missing.length > 0) {
      setError(`Ответьте на все вопросы. Без ответа: ${missing.length}.`);
      const first = missing[0];
      if (first) document.getElementById(`${first.id}-0`)?.focus();
      return;
    }
    setError(null);
    setChecked(true);
  };

  const reset = () => {
    setAnswers({});
    setChecked(false);
    setError(null);
  };

  return (
    <form className="quiz" onSubmit={onSubmit} noValidate>
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="quiz__question" disabled={checked}>
          <legend>
            <span className="quiz__num">Вопрос {qi + 1}</span>
            {q.text}
          </legend>
          <div className="quiz__options">
            {q.options.map((opt, oi) => {
              const id = `${q.id}-${oi}`;
              const chosen = answers[q.id] === oi;
              let state = '';
              if (checked && oi === q.correctIndex) state = ' option--correct';
              else if (checked && chosen) state = ' option--wrong';
              return (
                <label key={id} htmlFor={id} className={`option${chosen ? ' option--chosen' : ''}${state}`}>
                  <input
                    id={id}
                    type="radio"
                    name={q.id}
                    checked={chosen}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: oi }));
                      setError(null);
                    }}
                  />
                  <span>{opt}</span>
                  {checked && oi === q.correctIndex && <CircleCheck size={18} aria-label="Правильный ответ" />}
                  {checked && chosen && oi !== q.correctIndex && <CircleX size={18} aria-label="Неверный ответ" />}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {checked ? (
        <div className="quiz__result" role="status">
          <p>
            <strong>
              Результат: {correct} из {questions.length}
            </strong>
          </p>
          <p className="muted">Результат пока не сохраняется: хранение результатов в базе появится на следующем этапе.</p>
          <button type="button" className="btn btn--secondary" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> Пройти ещё раз
          </button>
        </div>
      ) : (
        <button type="submit" className="btn btn--primary">
          Проверить ответы
        </button>
      )}
    </form>
  );
}

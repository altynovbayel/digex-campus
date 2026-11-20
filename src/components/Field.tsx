import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
}

export function Field({ id, label, error, hint, onChange, ...inputProps }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  // Поле пароля: кнопка показа внутри поля. По умолчанию скрыт; у каждого поля своё состояние.
  // Кнопка всегда доступна (не теряет фокус, не зависит от того, как значение попало в поле).
  // Пароль снова скрывается: при отправке и сбросе формы, а также когда поле становится пустым.
  const isPassword = inputProps.type === 'password';
  const [shown, setShown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Управляемое поле, очищенное формой (например, после неудачного входа).
  const empty = inputProps.value === '';
  const [wasEmpty, setWasEmpty] = useState(empty);
  if (empty !== wasEmpty) {
    setWasEmpty(empty);
    if (empty) setShown(false);
  }

  // Отправка или сброс формы: следующий пароль (после ошибки) начинается скрытым, даже если показ
  // включили на пустом поле; перед сохранением в менеджер паролей поле снова в режиме пароля.
  useEffect(() => {
    const form = isPassword ? inputRef.current?.form : null;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener('submit', hide);
    form.addEventListener('reset', hide);
    return () => {
      form.removeEventListener('submit', hide);
      form.removeEventListener('reset', hide);
    };
    // form: при смене формы поля слушатели переходят на новую.
  }, [isPassword, inputProps.form]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Фактическое значение поля: работает и для неуправляемых полей.
    if (isPassword && e.currentTarget.value === '') setShown(false);
    onChange?.(e);
  };

  const input = (
    <input
      ref={inputRef}
      id={id}
      className={isPassword ? 'input input--with-action' : 'input'}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...inputProps}
      // Свой обработчик — только если есть внешний onChange или поле неуправляемое: иначе React не предупредит
      // о value без onChange.
      onChange={onChange || (isPassword && inputProps.value === undefined) ? handleChange : undefined}
      {...(isPassword
        ? {
            type: shown ? 'text' : 'password',
            // Видимый пароль клавиатура не должна исправлять и начинать с заглавной буквы.
            autoCapitalize: 'off',
            autoCorrect: 'off',
            spellCheck: false,
          }
        : {})}
    />
  );

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {isPassword ? (
        <div className="input-wrap">
          {input}
          <button
            type="button"
            className="input-wrap__action"
            aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
            aria-controls={id}
            // Нажатие мышью или пальцем не забирает фокус у поля: курсор и экранная клавиатура остаются.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
      ) : (
        input
      )}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

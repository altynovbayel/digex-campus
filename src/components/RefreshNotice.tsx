import { RotateCcw } from 'lucide-react';

/**
 * Обновление данных не удалось: на экране может быть устаревшее состояние.
 * saved = false — предшествующая запись завершилась ошибкой, поэтому не утверждаем, что изменение сохранено.
 */
export function RefreshNotice({ error, onRetry, saved = true }: { error: string | null; onRetry: () => void; saved?: boolean }) {
  if (!error) return null;
  return (
    <div className="alert alert--error" role="alert">
      <div>
        <p>
          {saved ? 'Изменение сохранено, но обновить данные не удалось: ' : 'Не удалось обновить данные: '}
          {error} На экране может быть устаревшее состояние.
        </p>
        <p>
          <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" /> Обновить
          </button>
        </p>
      </div>
    </div>
  );
}

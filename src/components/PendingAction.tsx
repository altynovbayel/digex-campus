import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';

interface Props {
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Поясняет, почему действие пока недоступно. */
  reason?: string;
  compact?: boolean;
}

/**
 * Кнопка действия, которое появится на следующих этапах.
 * Явно показывает, что оно временно недоступно.
 */
export function PendingAction({
  label,
  icon: Icon,
  variant = 'secondary',
  reason = 'Будет доступно после подключения базы данных',
  compact = false,
}: Props) {
  const id = useId();
  return (
    <span className={`pending${compact ? ' pending--compact' : ''}`}>
      <button type="button" className={`btn btn--${variant}`} disabled aria-describedby={id}>
        {Icon && <Icon size={16} aria-hidden="true" />}
        {label}
      </button>
      <span id={id} className="pending__note">
        {reason}
      </span>
    </span>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, text, action }: Props) {
  return (
    <div className="empty">
      <Icon className="empty__icon" size={36} aria-hidden="true" />
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error';

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert } as const;

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

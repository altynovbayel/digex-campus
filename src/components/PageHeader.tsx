import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, aside }: Props) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {aside && <div className="page-header__aside">{aside}</div>}
    </header>
  );
}

import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from './Logo';

export function FullPageLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="full-page" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={32} aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function FullPageMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth auth--narrow">
      <div className="auth__top">
        <Logo />
      </div>
      <section className="card auth__card" aria-labelledby="fp-title">
        <h1 id="fp-title" className="auth__card-title">
          {title}
        </h1>
        {children}
      </section>
    </div>
  );
}

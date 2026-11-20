import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { DEMO_MODE } from '../config';

/** Выход из аккаунта. В демо-режиме сессии нет — просто открывает страницу входа. */
export function LogoutButton({ className = 'nav-link nav-link--muted' }: { className?: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (DEMO_MODE) {
    return (
      <Link to="/login" className={className} title="Демо-режим: сессии нет">
        <LogOut size={20} aria-hidden="true" />
        <span>Выйти</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${className} nav-link--button`}
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { error: err } = await signOut();
            if (err) setError(err);
            else navigate('/login', { replace: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={20} aria-hidden="true" />
        <span>{busy ? 'Выходим…' : 'Выйти'}</span>
      </button>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

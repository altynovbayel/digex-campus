import { Link } from 'react-router-dom';
import { DEMO_MODE } from '../../config';

/** Ссылка на демо-кабинет — только в режиме разработки. */
export function DemoLink() {
  if (!DEMO_MODE) return null;
  return (
    <p className="auth__demo">
      <Link to="/">Открыть демо-кабинет (режим разработки)</Link>
    </p>
  );
}

interface SubmitProps {
  busy: boolean;
  label: string;
  busyLabel: string;
  /** Действие невозможно (например, Supabase не настроен). */
  unavailable?: boolean;
}

export function SubmitButton({ busy, label, busyLabel, unavailable = false }: SubmitProps) {
  return (
    <button type="submit" className="btn btn--primary btn--block" disabled={busy || unavailable} aria-busy={busy}>
      {busy ? busyLabel : label}
    </button>
  );
}

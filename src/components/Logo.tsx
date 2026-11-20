import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="DIGEX Campus — на главную">
      <span className="logo__mark" aria-hidden="true">
        <GraduationCap size={22} />
      </span>
      <span className="logo__text">
        DIGEX <small>Campus</small>
      </span>
    </Link>
  );
}

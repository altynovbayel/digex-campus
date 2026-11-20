import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <div className="auth auth--narrow">
      <div className="card">
        <EmptyState
          icon={SearchX}
          title="Страница не найдена"
          text="Проверьте адрес или вернитесь на главную."
          action={
            <Link to="/" className="btn btn--primary">
              На главную
            </Link>
          }
        />
      </div>
    </div>
  );
}

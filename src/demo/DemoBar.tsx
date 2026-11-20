/**
 * ТОЛЬКО ДЛЯ ДЕМОНСТРАЦИИ. Показывается только при VITE_DEMO_MODE=true в npm run dev
 * В обычном режиме не используется.
 */
import { FlaskConical, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEMO_STATUS_OPTIONS, isDemoStatus } from './scenarios';
import { useDemoSession } from './useDemoSession';

export function DemoBar() {
  const { demoStatus, setDemoStatus } = useDemoSession();
  return (
    <aside className="demo-bar" aria-label="Демонстрационный режим">
      <span className="demo-bar__label">
        <FlaskConical size={16} aria-hidden="true" />
        <strong>Режим разработки (демо).</strong> Вымышленный ученик, вход не выполнен, данные не из базы.
      </span>
      <span className="demo-bar__controls">
        <label htmlFor="demo-status">Состояние доступа:</label>
        <select
          id="demo-status"
          className="select select--sm"
          value={demoStatus}
          onChange={(e) => {
            if (isDemoStatus(e.target.value)) setDemoStatus(e.target.value);
          }}
        >
          {DEMO_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Link to="/admin" className="demo-bar__link">
          <Settings size={14} aria-hidden="true" /> Админка
        </Link>
      </span>
    </aside>
  );
}

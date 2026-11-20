import { BookOpen, ChevronRight, CreditCard, LayoutGrid, Menu, Settings, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogoutButton } from '../components/LogoutButton';
import { Logo } from '../components/Logo';
import { DEMO_MODE } from '../config';
import { DemoBar } from '../demo/DemoBar';
import { useCabinet } from '../cabinet/useCabinet';
import { initials } from '../lib/format';
import { useDrawer } from './useDrawer';

const NAV = [
  { to: '/', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/learning', label: 'Моё обучение', icon: BookOpen, end: false },
  { to: '/profile', label: 'Профиль и результаты', icon: UserRound, end: false },
  { to: '/payment', label: 'Оплата', icon: CreditCard, end: false },
] as const;

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/learning/')) return 'Урок';
  return NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? 'DIGEX Campus';
}

export function StudentLayout() {
  const { user: student, sections, refreshError } = useCabinet();
  const { state } = useAuth();
  const isAdmin = state.status === 'signed_in' && state.profile.status === 'ready' && state.profile.profile.role === 'admin';
  const { pathname } = useLocation();
  const { open, setOpen, openerRef, closeRef, panelRef } = useDrawer();
  const title = pageTitle(pathname);

  return (
    <div className="shell">
      <a href="#main" className="skip-link" inert={open}>
        Перейти к содержимому
      </a>

      <aside ref={panelRef} id="sidebar" className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Основная навигация">
        <div className="sidebar__head">
          <Logo />
          <button
            type="button"
            ref={closeRef}
            className="icon-btn sidebar__close"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__section">Моё пространство</p>
          <ul>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="nav-link">
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                  {to === '/learning' && sections.length > 0 && (
                    <span className="nav-link__count" aria-label={`разделов: ${sections.length}`}>
                      {sections.length}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__account">
          <Link to="/profile" className="account">
            <span className="avatar" aria-hidden="true">
              {initials(student.name)}
            </span>
            <span className="account__info">
              <span className="account__name">{student.name}</span>
              <span className="account__email">{student.email}</span>
            </span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="nav-link nav-link--muted">
              <Settings size={20} aria-hidden="true" />
              <span>Панель администратора</span>
            </Link>
          )}
          <LogoutButton />
        </div>
      </aside>

      {open && <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="shell__body" inert={open}>
        <header className="topbar">
          <button
            type="button"
            ref={openerRef}
            className="icon-btn topbar__menu"
            onClick={() => setOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={open}
            aria-controls="sidebar"
          >
            <Menu size={22} />
          </button>
          <nav aria-label="Хлебные крошки" className="crumbs">
            <span className="crumbs__root">Моё пространство</span>
            <ChevronRight size={16} aria-hidden="true" />
            <span aria-current="page">{title}</span>
          </nav>
          <span className="topbar__motto">Учись. Создавай. Развивайся.</span>
          <Link to="/profile" className="avatar topbar__avatar" aria-label="Профиль">
            {initials(student.name)}
          </Link>
        </header>

        {DEMO_MODE && <DemoBar />}

        {refreshError && (
          <p className="refresh-error" role="status">
            Не удалось обновить данные: {refreshError} На экране — последние загруженные данные; повторим автоматически.
          </p>
        )}

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>

        <footer className="footer">
          <span>© {new Date().getFullYear()} DIGEX Campus</span>
          <span>Учись сегодня. Создавай завтра.</span>
        </footer>
      </div>
    </div>
  );
}

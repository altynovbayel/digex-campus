import { ArrowLeft, BarChart3, FlaskConical, Layers, Menu, Settings, Users, X } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogoutButton } from '../components/LogoutButton';
import { Logo } from '../components/Logo';
import { DEMO_MODE } from '../config';
import { useDrawer } from './useDrawer';

const NAV = [
  { to: '/admin/groups', label: 'Разделы и уроки', icon: Layers },
  { to: '/admin/students', label: 'Ученики', icon: Users },
  { to: '/admin/results', label: 'Результаты', icon: BarChart3 },
  { to: '/admin/settings', label: 'Настройки', icon: Settings },
] as const;

export function AdminLayout() {
  const { open, setOpen, openerRef, closeRef, panelRef } = useDrawer();

  return (
    <div className="shell shell--admin">
      <a href="#main" className="skip-link" inert={open}>
        Перейти к содержимому
      </a>

      <aside ref={panelRef} id="admin-sidebar" className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Навигация администратора">
        <div className="sidebar__head">
          <Logo to="/admin" />
          <button type="button" ref={closeRef}
            className="icon-btn sidebar__close" onClick={() => setOpen(false)} aria-label="Закрыть меню">
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar__nav">
          <p className="sidebar__section">Администрирование</p>
          <ul>
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className="nav-link">
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar__account">
          <Link to="/" className="nav-link nav-link--muted">
            <ArrowLeft size={20} aria-hidden="true" />
            <span>В кабинет ученика</span>
          </Link>
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
            aria-controls="admin-sidebar"
          >
            <Menu size={22} />
          </button>
          <span className="topbar__title">Панель администратора</span>
        </header>

        {DEMO_MODE && (
          <aside className="demo-bar" aria-label="Демонстрационный режим">
            <span className="demo-bar__label">
              <FlaskConical size={16} aria-hidden="true" />
              <strong>Режим разработки (демо).</strong> Вымышленные ученики и результаты, вход не выполнен, изменения не
              сохраняются.
            </span>
          </aside>
        )}

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

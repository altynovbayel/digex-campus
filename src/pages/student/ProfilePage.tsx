import { Link } from 'react-router-dom';
import { LogoutButton } from '../../components/LogoutButton';
import { PageHeader } from '../../components/PageHeader';
import { ProfileForm } from './ProfileForm';
import { AttemptHistory } from './AttemptHistory';
import { AccessSummary } from '../../components/AccessSummary';
import { useAuth } from '../../auth/useAuth';
import { useCabinet } from '../../cabinet/useCabinet';
import { initials } from '../../lib/format';

export function ProfilePage() {
  const { user, access, payments, stats, mode } = useCabinet();
  const { sessionKey } = useAuth();

  return (
    <>
      <PageHeader eyebrow="Личный кабинет" title="Мой профиль" subtitle="Твои знания, достижения и результаты." />

      <div className="two-col">
        <section className="card" aria-labelledby="personal-title">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(user.name)}
          </span>
          <h2 id="personal-title" className="card__title">
            Личная информация
          </h2>
          {/* Новая сессия — новая форма: состояние и finally запроса прошлой сессии сюда не попадают. */}
          <ProfileForm
            key={sessionKey ?? 'demo'}
            name={user.name}
            email={user.email}
            demo={mode === 'demo'}
          />
          <div className="profile-logout">
            <LogoutButton className="btn btn--ghost" />
          </div>
        </section>

        <section className="card" aria-labelledby="study-title">
          <h2 id="study-title" className="card__title">
            Информация об обучении
          </h2>
          <dl className="info-list">
            <div className="info-list__block">
              <dt>Доступ к обучению</dt>
              <dd>
                <AccessSummary access={access} />
              </dd>
            </div>
            <div>
              <dt>Подтверждённых оплат</dt>
              <dd>
                <Link to="/payment" className="link">
                  {payments.length}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Пройдено тестов</dt>
              <dd>{stats.testsPassed}</dd>
            </div>
            <div>
              <dt>Попыток</dt>
              <dd>{stats.attempts}</dd>
            </div>
            <div>
              <dt>Средний результат</dt>
              <dd>{stats.averagePercent === null ? '—' : `${stats.averagePercent}%`}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card" aria-labelledby="results-title">
        <h2 id="results-title" className="card__title">
          Результаты тестов
        </h2>
        <AttemptHistory />
      </section>
    </>
  );
}

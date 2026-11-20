import { ArrowUpRight, BookOpen, CheckCircle2, CircleCheck, Target, TrendingUp, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccessBadge } from '../../components/StatusBadges';
import { PageHeader } from '../../components/PageHeader';
import { ProgressRing } from '../../components/ProgressRing';
import { courseInfo } from '../../data/course';
import { useCabinet } from '../../cabinet/useCabinet';
import { formatDateTime, percent } from '../../lib/format';
import type { CourseAccess } from '../../types';

/** Короткая строка об общем доступе к курсу. Статус вычислен базой по серверному времени. */
function AccessLine({ access }: { access: CourseAccess }) {
  switch (access.status) {
    case 'active':
      return <>Доступ ко всем разделам открыт до {formatDateTime(access.endsAt)}.</>;
    case 'revoked':
      return (
        <>
          Доступ отозван администратором. История оплаты сохранена в <Link to="/payment">разделе оплаты</Link>.
        </>
      );
    case 'expired':
      return (
        <>
          Срок доступа закончился. Профиль и история оплаты сохранены. <Link to="/payment">Подробнее</Link>
        </>
      );
    default:
      return (
        <>
          Доступ откроется после подтверждения оплаты. <Link to="/payment">Подробнее</Link>
        </>
      );
  }
}

export function HomePage() {
  const { user, access, stats: quiz, availableLessons } = useCabinet();
  // Показатели тестирования вычислены базой (my_quiz_stats).
  const progress = percent(quiz.passedPublished, quiz.publishedTotal);
  const firstName = user.name.split(' ')[0] ?? user.name;
  const stats = { totalLessons: availableLessons, testsPassed: quiz.testsPassed, progress };

  return (
    <>
      <PageHeader
        eyebrow="Твоё пространство для роста"
        title={`С возвращением, ${firstName}!`}
        subtitle="Каждый урок — ещё один шаг к твоей цели."
        aside={<AccessBadge status={access.status} />}
      />

      <div className="home-grid">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__body">
            <p className="eyebrow eyebrow--accent">Твоё будущее начинается здесь</p>
            <h2 id="hero-title" className="hero__title">
              {courseInfo.tagline}
            </h2>
            <p className="hero__text">{courseInfo.description}</p>

            <p className="hero__access">
              <AccessLine access={access} />
            </p>

            <Link to="/learning" className="btn btn--primary btn--lg">
              К моему обучению <ArrowUpRight size={18} aria-hidden="true" />
            </Link>

            <ul className="hero__chips">
              <li>
                <Video size={16} aria-hidden="true" /> Видеоуроки
              </li>
              <li>
                <Target size={16} aria-hidden="true" /> Практика и тесты
              </li>
            </ul>
          </div>

          <div className="hero__art" aria-hidden="true">
            <div className="code-card">
              <div className="code-card__bar">
                <i />
                <i />
                <i />
                <span>Новый запрос</span>
              </div>
              <p className="prompt-card">
                Помоги составить план обучения.
                <br />
                <span className="t">Моя цель</span> — …
                <br />
                <span className="t">Мой уровень</span> — …
                <br />
                <span className="t">Время на практику</span> — …
              </p>
            </div>
            <div className="toast-card">
              <CircleCheck size={22} />
              <div>
                <strong>Отличное начало!</strong>
                <span>Новые навыки уже близко</span>
              </div>
            </div>
          </div>
        </section>

        <section className="card progress-card" aria-labelledby="progress-title">
          <div className="card__head">
            <h2 id="progress-title" className="card__title">
              Твой прогресс
            </h2>
            <TrendingUp size={20} className="muted" aria-hidden="true" />
          </div>
          <ProgressRing value={stats.progress} label="тестов пройдено" />
          <div className="progress-card__row">
            <span className="muted">Пройдено тестов программы</span>
            <span>
              <strong>{quiz.passedPublished}</strong> / {quiz.publishedTotal}
            </span>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-label="Пройдено тестов программы"
            aria-valuemin={0}
            aria-valuemax={quiz.publishedTotal}
            aria-valuenow={quiz.passedPublished}
          >
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <p className="progress-card__quote">«Большой путь начинается с маленького шага»</p>
        </section>

        <ul className="stats" aria-label="Основные показатели">
          <li className="stat">
            <span className="stat__icon stat__icon--violet" aria-hidden="true">
              <BookOpen size={22} />
            </span>
            <span>
              <strong className="stat__value">{stats.totalLessons}</strong>
              <span className="stat__label">Доступно уроков</span>
            </span>
          </li>
          <li className="stat">
            <span className="stat__icon stat__icon--amber" aria-hidden="true">
              <CheckCircle2 size={22} />
            </span>
            <span>
              <strong className="stat__value">{stats.testsPassed}</strong>
              <span className="stat__label">
                Тестов пройдено · попыток: {quiz.attempts}
              </span>
            </span>
          </li>
          <li className="stat">
            <span className="stat__icon stat__icon--green" aria-hidden="true">
              <TrendingUp size={22} />
            </span>
            <span>
              <strong className="stat__value">
                {quiz.averagePercent === null ? '—' : quiz.averagePercent}
                {quiz.averagePercent !== null && <small>%</small>}
              </strong>
              <span className="stat__label">Средний результат</span>
            </span>
          </li>
        </ul>
      </div>
    </>
  );
}

import { BookOpenCheck, ChevronRight, CircleCheck, PlayCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCabinet } from '../../cabinet/useCabinet';
import { AccessLocked } from '../../components/AccessLocked';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { AccessBadge } from '../../components/StatusBadges';
import { formatDateTime, pluralize } from '../../lib/format';
import { useSessionQuery } from '../../lib/useSessionQuery';
import type { Section } from '../../types';

/** Уроки раздела. Список приходит из базы только при действующем общем доступе (RLS). */
function SectionLessons({ section }: { section: Section }) {
  const { dataKey, listLessons, stats, access, revision } = useCabinet();
  // Ключ включает состояние доступа: после нового периода список загружается заново.
  const { state, reload } = useSessionQuery(
    `lessons:${dataKey}:${section.id}:${access.status}:${access.endsAt ?? ''}`,
    () => listLessons(section.id),
  );
  const doneIds = new Set(stats.passedLessonIds);
  // Перепроверка списка при каждом обновлении кабинета (публикация, архив) — без мигания.
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    reload();
  }, [revision, reload]);

  if (state.status === 'loading') {
    return (
      <p className="loading-row" role="status">
        Загружаем уроки…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <Alert tone="error">{state.message}</Alert>
        <button type="button" className="btn btn--secondary" onClick={reload}>
          <RotateCcw size={16} aria-hidden="true" /> Повторить
        </button>
      </>
    );
  }
  if (state.data.length === 0) {
    return <EmptyState icon={BookOpenCheck} title="Первый урок скоро появится" text="Следи за обновлениями." />;
  }
  return (
    <ol className="lesson-list">
      {state.data.map((l, i) => (
        <li key={l.id}>
          <Link to={`/learning/${encodeURIComponent(l.id)}`} className="lesson-item">
            <span className="lesson-item__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="lesson-item__body">
              <span className="lesson-item__title">{l.title}</span>
              <span className="lesson-item__meta">
                <PlayCircle size={14} aria-hidden="true" /> Материал и практика
              </span>
            </span>
            {doneIds.has(l.id) && (
              <span className="lesson-item__done">
                <CircleCheck size={16} aria-hidden="true" /> Тест пройден
              </span>
            )}
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function LearningPage() {
  const { sections, access } = useCabinet();
  const [params, setParams] = useSearchParams();
  const selected = sections.find((s) => s.id === params.get('group')) ?? sections[0];

  return (
    <>
      <PageHeader
        eyebrow="Шаг за шагом"
        title="Моё обучение"
        subtitle="Два раздела одного курса. Одна оплата открывает оба."
        aside={<AccessBadge status={access.status} />}
      />

      {access.status === 'active' && access.endsAt && (
        <p className="muted small">Доступ ко всем разделам открыт до {formatDateTime(access.endsAt)}.</p>
      )}

      {!selected ? (
        <div className="card">
          <EmptyState icon={BookOpenCheck} title="Разделы курса скоро появятся" text="Следи за обновлениями." />
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Разделы курса">
            {sections.map((s) => {
              const isSelected = s.id === selected.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-selected={isSelected}
                  aria-controls="section-panel"
                  tabIndex={isSelected ? 0 : -1}
                  className={`tab${isSelected ? ' tab--active' : ''}`}
                  onClick={() => setParams({ group: s.id }, { replace: true })}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const idx = sections.findIndex((x) => x.id === s.id);
                    const next = sections[(idx + (e.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length];
                    if (next) {
                      setParams({ group: next.id }, { replace: true });
                      document.getElementById(`tab-${next.id}`)?.focus();
                    }
                  }}
                >
                  {s.title}
                </button>
              );
            })}
          </div>

          <section id="section-panel" role="tabpanel" aria-labelledby={`tab-${selected.id}`} className="card group-panel">
            <div className="card__head">
              <div>
                <h2 className="card__title">{selected.title}</h2>
                <p className="muted">{selected.description}</p>
                <p className="muted small">
                  {selected.lessonsCount} {pluralize(selected.lessonsCount, ['урок', 'урока', 'уроков'])}
                </p>
              </div>
              <Sparkles size={26} className="group-panel__icon" aria-hidden="true" />
            </div>

            {access.status === 'active' ? (
              <SectionLessons key={selected.id} section={selected} />
            ) : (
              <AccessLocked access={access} idSuffix={selected.id} />
            )}
          </section>
        </>
      )}
    </>
  );
}

import { BookOpenCheck, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PendingAction } from '../components/PendingAction';
import { DEMO_MODE } from '../config';
import { courseGroups, getGroupLessons } from '../data/course';
import { demoStudents } from './people';

/** ТОЛЬКО ДЛЯ РЕЖИМА РАЗРАБОТКИ: просмотр локальной программы без сохранения. */
export function DemoGroupsView() {
  const [groupId, setGroupId] = useState(courseGroups[0]?.id ?? '');
  const group = courseGroups.find((g) => g.id === groupId);
  const lessons = group ? getGroupLessons(group.id) : [];

  return (
    <>
      <PageHeader
        title="Разделы и уроки"
        subtitle="Программа предварительная: названия, порядок и содержание уроков можно будет менять."
        aside={<PendingAction label="Создать раздел" icon={Plus} variant="primary" compact />}
      />

      <section className="card" aria-labelledby="groups-title">
        <h2 id="groups-title" className="card__title">
          Разделы
        </h2>
        {courseGroups.length === 0 ? (
          <EmptyState icon={BookOpenCheck} title="Разделов пока нет" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Разделы">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Название</th>
                  <th scope="col">Уроков</th>
                  {DEMO_MODE && <th scope="col">Учеников</th>}
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {courseGroups.map((g) => (
                  <tr key={g.id} className={g.id === groupId ? 'is-selected' : undefined}>
                    <td>
                      <strong>{g.title}</strong>
                      <div className="muted small">{g.description}</div>
                    </td>
                    <td>{getGroupLessons(g.id).length}</td>
                    {DEMO_MODE && <td>{demoStudents.filter((s) => s.groupIds.includes(g.id)).length}</td>}
                    <td className="table__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setGroupId(g.id)}
                        aria-pressed={g.id === groupId}
                      >
                        Уроки
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {group && (
        <section className="card" aria-labelledby="lessons-title">
          <div className="card__head">
            <h2 id="lessons-title" className="card__title">
              Уроки: {group.title}
            </h2>
            <PendingAction label="Добавить урок" icon={Plus} compact />
          </div>
          {lessons.length === 0 ? (
            <EmptyState
              icon={BookOpenCheck}
              title={DEMO_MODE ? 'В этом разделе пока нет уроков' : 'Программа уроков переносится в базу'}
              text={
                DEMO_MODE
                  ? undefined
                  : 'Уроки будут храниться в базе с доступом по правам — это следующий этап. До этого в обычной сборке их нет.'
              }
            />
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label={`Уроки раздела ${group.title}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">№</th>
                    <th scope="col">Название</th>
                    <th scope="col">Видео</th>
                    <th scope="col">Вопросов в тесте</th>
                    <th scope="col">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((l) => (
                    <tr key={l.id}>
                      <td>{l.order}</td>
                      <td>{l.title}</td>
                      <td className="muted">{l.youtubeUrl ? 'Добавлено' : 'Скоро появится'}</td>
                      <td>{l.quiz.length || '—'}</td>
                      <td className="table__actions">
                        <PendingAction label="Изменить" icon={Pencil} variant="ghost" compact reason="Скоро" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

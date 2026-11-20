import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ClipboardList, Eye, EyeOff, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { listAdminLessons, listGroups, moveLesson, updateGroup, updateLesson, type AdminGroup, type AdminLesson } from '../../api/admin';
import { errorText } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { RefreshNotice } from '../../components/RefreshNotice';
import { useSessionQuery } from '../../lib/useSessionQuery';
import { GroupForm } from './GroupForm';
import { LessonForm } from './LessonForm';
import { QuizEditor } from './QuizEditor';

/** Выполняет действие с блокировкой кнопок и показом ошибки; после успеха — onDone. */
function useAction(onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Синхронная защита от двойного нажатия: срабатывает до перерисовки.
  const inFlight = useRef(false);
  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };
  return { busy, error, run };
}

function LessonsManager({ group }: { group: AdminGroup }) {
  const { sessionKey } = useAuth();
  const { state, reload, refreshError } = useSessionQuery(sessionKey ? `admin-lessons:${sessionKey}:${group.id}` : null, () =>
    listAdminLessons(group.id),
  );
  const [form, setForm] = useState<{ lesson: AdminLesson | null } | null>(null);
  const [quizLesson, setQuizLesson] = useState<AdminLesson | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const action = useAction(reload);

  const all = state.status === 'ready' ? state.data : [];
  const active = all.filter((l) => !l.archivedAt);
  const visible = showArchived ? all : active;
  const nextPosition = active.reduce((m, l) => Math.max(m, l.position), 0) + 1;

  return (
    <section className="card" aria-labelledby="lessons-title">
      <div className="card__head">
        <div>
          <h2 id="lessons-title" className="card__title">
            Уроки: {group.title}
          </h2>
          <label className="checkbox small" htmlFor="show-archived-lessons">
            <input
              id="show-archived-lessons"
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Показывать архивные
          </label>
        </div>
        {!form && (
          <button type="button" className="btn btn--secondary" onClick={() => setForm({ lesson: null })} disabled={Boolean(group.archivedAt)}>
            <Plus size={16} aria-hidden="true" /> Добавить урок
          </button>
        )}
      </div>

      {form && (
        <LessonForm
          key={form.lesson?.id ?? 'new'}
          groupId={group.id}
          lesson={form.lesson}
          nextPosition={nextPosition}
          onSaved={() => {
            setForm(null);
            reload();
          }}
          onCancel={() => setForm(null)}
        />
      )}

      {action.error && <Alert tone="error">{action.error}</Alert>}
      <RefreshNotice error={refreshError} onRetry={reload} />

      {state.status === 'loading' && (
        <p className="loading-row" role="status">
          Загружаем уроки…
        </p>
      )}
      {state.status === 'error' && (
        <>
          <Alert tone="error">{state.message}</Alert>
          <button type="button" className="btn btn--secondary" onClick={reload}>
            <RotateCcw size={16} aria-hidden="true" /> Повторить
          </button>
        </>
      )}
      {state.status === 'ready' &&
        (visible.length === 0 ? (
          <EmptyState icon={Plus} title="В этом разделе пока нет уроков" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={`Уроки раздела ${group.title}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Название</th>
                  <th scope="col">Состояние</th>
                  <th scope="col">Видео</th>
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const idx = active.findIndex((x) => x.id === l.id);
                  const disabled = action.busy !== null;
                  return (
                    <tr key={l.id}>
                      <td>{l.position}</td>
                      <td>{l.title}</td>
                      <td>
                        {l.archivedAt ? (
                          <Badge>В архиве</Badge>
                        ) : l.published ? (
                          <Badge tone="success">Опубликован</Badge>
                        ) : (
                          <Badge tone="warning">Черновик</Badge>
                        )}
                      </td>
                      <td className="muted">{l.youtubeUrl ? 'Есть' : 'Скоро появится'}</td>
                      <td>
                        <div className="row-actions">
                          {!l.archivedAt && (
                            <>
                              <button
                                type="button"
                                className="icon-btn icon-btn--sm"
                                aria-label={`Выше: ${l.title}`}
                                disabled={disabled || idx <= 0}
                                onClick={() => action.run(`up:${l.id}`, () => moveLesson(l.id, -1))}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn--sm"
                                aria-label={`Ниже: ${l.title}`}
                                disabled={disabled || idx === active.length - 1}
                                onClick={() => action.run(`down:${l.id}`, () => moveLesson(l.id, 1))}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                disabled={disabled}
                                onClick={() => action.run(`pub:${l.id}`, () => updateLesson(l.id, { published: !l.published }))}
                              >
                                {l.published ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                {l.published ? 'Снять с публикации' : 'Опубликовать'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                disabled={disabled}
                                onClick={() => setForm({ lesson: l })}
                              >
                                <Pencil size={16} aria-hidden="true" /> Изменить
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                aria-pressed={quizLesson?.id === l.id}
                                onClick={() => setQuizLesson(l)}
                              >
                                <ClipboardList size={16} aria-hidden="true" /> Тест
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={disabled}
                            onClick={() => action.run(`arch:${l.id}`, () => updateLesson(l.id, { archived: !l.archivedAt }))}
                          >
                            {l.archivedAt ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                            {l.archivedAt ? 'Вернуть' : 'В архив'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      {quizLesson && <QuizEditor key={quizLesson.id} lesson={quizLesson} onClose={() => setQuizLesson(null)} />}
    </section>
  );
}

export function GroupsManager() {
  const { sessionKey } = useAuth();
  const { state, reload, refreshError } = useSessionQuery(sessionKey ? `admin-groups:${sessionKey}` : null, listGroups);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ group: AdminGroup | null } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const action = useAction(() => {
    setConfirmArchive(null);
    reload();
  });

  const groups = state.status === 'ready' ? state.data : [];
  const selected = groups.find((g) => g.id === selectedId) ?? groups.find((g) => !g.archivedAt) ?? null;

  return (
    <>
      <PageHeader
        title="Разделы и уроки"
        subtitle="Разделы курса, уроки, порядок и публикация. Вместо удаления — архив: история учеников сохраняется."
        aside={
          !form && (
            <button type="button" className="btn btn--primary" onClick={() => setForm({ group: null })}>
              <Plus size={16} aria-hidden="true" /> Создать раздел
            </button>
          )
        }
      />

      {form && (
        <section className="card">
          <GroupForm
            key={form.group?.id ?? 'new'}
            group={form.group}
            onSaved={() => {
              setForm(null);
              reload();
            }}
            onCancel={() => setForm(null)}
          />
        </section>
      )}

      <section className="card" aria-labelledby="groups-title">
        <h2 id="groups-title" className="card__title">
          Разделы
        </h2>
        {action.error && <Alert tone="error">{action.error}</Alert>}
        <RefreshNotice error={refreshError} onRetry={reload} />
        {state.status === 'loading' && (
          <p className="loading-row" role="status">
            Загружаем разделы…
          </p>
        )}
        {state.status === 'error' && (
          <>
            <Alert tone="error">{state.message}</Alert>
            <button type="button" className="btn btn--secondary" onClick={reload}>
              <RotateCcw size={16} aria-hidden="true" /> Повторить
            </button>
          </>
        )}
        {state.status === 'ready' &&
          (groups.length === 0 ? (
            <EmptyState icon={Plus} title="Разделов пока нет" text="Создайте раздел или выполните начальное наполнение (README)." />
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Разделы">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Раздел</th>
                    <th scope="col">Состояние</th>
                    <th scope="col">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className={g.id === selected?.id ? 'is-selected' : undefined}>
                      <td>
                        <strong>{g.title}</strong>
                        <div className="muted small">
                          {g.id}
                          {g.description ? ` · ${g.description}` : ''}
                        </div>
                      </td>
                      <td>{g.archivedAt ? <Badge>В архиве</Badge> : <Badge tone="success">Активен</Badge>}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setSelectedId(g.id)}
                            aria-pressed={g.id === selected?.id}
                          >
                            Уроки
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setForm({ group: g })}
                            disabled={action.busy !== null}
                          >
                            <Pencil size={16} aria-hidden="true" /> Изменить
                          </button>
                          {g.archivedAt ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={action.busy !== null}
                              onClick={() => action.run(`arch:${g.id}`, () => updateGroup(g.id, { archived: false }))}
                            >
                              <ArchiveRestore size={16} aria-hidden="true" /> Вернуть
                            </button>
                          ) : confirmArchive === g.id ? (
                            <span className="confirm-inline" role="group" aria-label="Подтверждение архивации">
                              <span className="small">Уроки этого раздела сразу скроются у учеников. Общий доступ к курсу и остальные разделы не изменятся.</span>
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                disabled={action.busy !== null}
                                onClick={() => action.run(`arch:${g.id}`, () => updateGroup(g.id, { archived: true }))}
                              >
                                {action.busy === `arch:${g.id}` ? 'Архивируем…' : 'Да, в архив'}
                              </button>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmArchive(null)}>
                                Отмена
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={action.busy !== null}
                              onClick={() => setConfirmArchive(g.id)}
                            >
                              <Archive size={16} aria-hidden="true" /> В архив
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      {selected && <LessonsManager key={selected.id} group={selected} />}
    </>
  );
}

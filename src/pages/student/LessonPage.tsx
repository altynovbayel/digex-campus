import { useEffect, useRef } from 'react';
import { ArrowLeft, ClipboardList, FileText, MessageSquareText, PencilLine, RotateCcw, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useCabinet } from '../../cabinet/useCabinet';
import { AccessLocked } from '../../components/AccessLocked';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Quiz } from '../../components/Quiz';
import { VideoBlock } from '../../components/VideoBlock';
import { LessonQuiz } from './LessonQuiz';
import { useSessionQuery } from '../../lib/useSessionQuery';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const { mode, dataKey, getLesson, access, sections, revision } = useCabinet();
  const { state: auth } = useAuth();
  const isAdmin = auth.status === 'signed_in' && auth.profile.status === 'ready' && auth.profile.profile.role === 'admin';
  // Урок запрашивается из базы; без активного доступа RLS его не вернёт — прямой URL не обходит ограничение.
  // Ключ включает состояние общего доступа: при его изменении урок перепроверяется на сервере.
  const { state, reload } = useSessionQuery(
    `lesson:${dataKey}:${lessonId}:${access.status}:${access.endsAt ?? ''}`,
    () => getLesson(lessonId),
  );

  // При каждом обновлении данных кабинета перепроверяем урок на сервере (снят с публикации, архив, раздел скрыт).
  // Прежние данные остаются на экране до ответа — без мигания.
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    reload();
  }, [revision, reload]);

  // Без действующего общего доступа материалы любого раздела закрыты — в том числе уже открытый урок
  // (статус перепроверяется при окончании периода). Администратор может просматривать любые уроки.
  if (!isAdmin && access.status !== 'active') {
    return <AccessLocked access={access} />;
  }

  if (state.status === 'loading') {
    return (
      <p className="loading-row" role="status">
        Загружаем урок…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="card">
        <Alert tone="error">{state.message}</Alert>
        <button type="button" className="btn btn--secondary" onClick={reload}>
          <RotateCcw size={16} aria-hidden="true" /> Повторить
        </button>
      </div>
    );
  }

  // Ученику не показываем урок раздела, которого нет среди доступных (например, раздел ушёл в архив).
  const lesson = state.data && (isAdmin || sections.some((s) => s.id === state.data?.groupId)) ? state.data : null;
  if (!lesson) {
    return (
      <div className="card">
        <EmptyState
          icon={SearchX}
          title="Урок недоступен"
          text="Возможно, урок ещё не опубликован, снят администратором или раздел в архиве."
          action={
            <Link to="/learning" className="btn btn--secondary">
              <ArrowLeft size={16} aria-hidden="true" /> Моё обучение
            </Link>
          }
        />
      </div>
    );
  }

  const groupTitle = sections.find((s) => s.id === lesson.groupId)?.title ?? 'Моё обучение';

  return (
    <>
      <Link to={`/learning?group=${encodeURIComponent(lesson.groupId)}`} className="link back-link">
        <ArrowLeft size={16} aria-hidden="true" /> {groupTitle}
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">Урок {lesson.order}</p>
          <h1 className="page-header__title">{lesson.title}</h1>
          {!lesson.published && <Badge tone="warning">Черновик — виден только администратору</Badge>}
          {lesson.goal && (
            <p className="page-header__subtitle">
              <strong>Цель урока:</strong> {lesson.goal}
            </p>
          )}
        </div>
      </header>

      <div className="lesson">
        <section className="card" aria-labelledby="video-title">
          <h2 id="video-title" className="card__title">
            Видео
          </h2>
          <VideoBlock url={lesson.youtubeUrl} title={lesson.title} />
        </section>

        <section className="card" aria-labelledby="material-title">
          <h2 id="material-title" className="card__title">
            <FileText size={20} aria-hidden="true" /> Материал урока
          </h2>
          <div className="prose">
            {lesson.content.length > 0 ? lesson.content.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">Текст урока скоро появится.</p>}
          </div>
        </section>

        {lesson.examplePrompt && (
          <section className="card" aria-labelledby="prompt-title">
            <h2 id="prompt-title" className="card__title">
              <MessageSquareText size={20} aria-hidden="true" /> Пример запроса
            </h2>
            <blockquote className="prompt-example">{lesson.examplePrompt}</blockquote>
            <p className="muted small">Данные в примере вымышленные. Подставьте свою ситуацию.</p>
          </section>
        )}

        {lesson.task && (
          <section className="card" aria-labelledby="task-title">
            <h2 id="task-title" className="card__title">
              <PencilLine size={20} aria-hidden="true" /> Практическое задание
            </h2>
            <p className="prose">{lesson.task}</p>
          </section>
        )}

        <section className="card" aria-labelledby="quiz-title">
          <h2 id="quiz-title" className="card__title">
            <ClipboardList size={20} aria-hidden="true" /> Вопросы для закрепления
          </h2>
          {mode === 'demo' ? (
            lesson.quiz.length > 0 ? (
              <>
                <Alert tone="info">
                  Демо-режим: проверка выполняется в браузере и не сохраняется. Это не настоящий тест.
                </Alert>
                <Quiz key={lesson.id} questions={lesson.quiz} />
              </>
            ) : (
              <EmptyState icon={ClipboardList} title="Тест к уроку пока недоступен" />
            )
          ) : (
            <LessonQuiz key={lesson.id} lessonId={lesson.id} />
          )}
        </section>
      </div>
    </>
  );
}

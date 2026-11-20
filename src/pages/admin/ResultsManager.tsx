import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { adminQuizResults, listAdminLessons, listGroups, studentsOverview } from '../../api/admin';
import { useAuth } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { ResultsTable } from '../../components/ResultsTable';
import { useSessionQuery } from '../../lib/useSessionQuery';

/** Результаты учеников из базы с фильтрами по ученику, разделу и уроку. Простая таблица. */
export function ResultsManager() {
  const { sessionKey } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [lessonId, setLessonId] = useState('');

  const students = useSessionQuery(sessionKey ? `admin-students:${sessionKey}` : null, studentsOverview);
  const sections = useSessionQuery(sessionKey ? `admin-groups:${sessionKey}` : null, listGroups);
  const lessons = useSessionQuery(sessionKey && sectionId ? `admin-lessons:${sessionKey}:${sectionId}` : null, () =>
    listAdminLessons(sectionId),
  );
  const filtersKey = `${studentId}|${sectionId}|${lessonId}`;
  const results = useSessionQuery(sessionKey ? `admin-results:${sessionKey}:${filtersKey}` : null, () =>
    adminQuizResults({ studentId: studentId || null, sectionId: sectionId || null, lessonId: lessonId || null }),
  );

  // Ошибки справочников фильтров не прячем за пустыми списками: показываем и даём повторить.
  const listErrors = [
    { name: 'учеников', q: students },
    { name: 'разделов', q: sections },
    { name: 'уроков', q: lessons },
  ].filter((x) => x.q.state.status === 'error');
  const studentList = students.state.status === 'ready' ? students.state.data : [];
  const sectionList = sections.state.status === 'ready' ? sections.state.data : [];
  const lessonList = sectionId && lessons.state.status === 'ready' ? lessons.state.data : [];

  return (
    <section className="card" aria-labelledby="results-title">
      <h2 id="results-title" className="card__title">
        Результаты тестов
      </h2>
      <div className="filters" role="group" aria-label="Фильтры">
        <div className="field">
          <label className="field__label" htmlFor="filter-student">
            Ученик
          </label>
          <select id="filter-student" className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">{students.state.status === 'loading' ? 'Загружаем…' : 'Все ученики'}</option>
            {studentList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.email ? ` (${s.email})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="filter-section">
            Раздел
          </label>
          <select
            id="filter-section"
            className="select"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setLessonId('');
            }}
          >
            <option value="">{sections.state.status === 'loading' ? 'Загружаем…' : 'Все разделы'}</option>
            {sectionList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="filter-lesson">
            Урок
          </label>
          <select
            id="filter-lesson"
            className="select"
            value={lessonId}
            disabled={!sectionId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            <option value="">{sectionId ? 'Все уроки раздела' : 'Сначала выберите раздел'}</option>
            {lessonList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.position}. {l.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listErrors.map((x) => (
        <Alert key={x.name} tone="error">
          <p>
            Не удалось загрузить список {x.name}: {x.q.state.status === 'error' ? x.q.state.message : ''}
          </p>
          <p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={x.q.reload}>
              <RotateCcw size={16} aria-hidden="true" /> Повторить
            </button>
          </p>
        </Alert>
      ))}

      {results.state.status === 'loading' && (
        <p className="loading-row" role="status">
          Загружаем результаты…
        </p>
      )}
      {results.state.status === 'error' && (
        <>
          <Alert tone="error">{results.state.message}</Alert>
          <button type="button" className="btn btn--secondary" onClick={results.reload}>
            <RotateCcw size={16} aria-hidden="true" /> Повторить
          </button>
        </>
      )}
      {results.state.status === 'ready' && (
        <ResultsTable
          rows={results.state.data}
          caption="Результаты тестов учеников"
          showStudent
          emptyText={filtersKey === '||' ? 'Результатов пока нет.' : 'По выбранным фильтрам результатов нет.'}
        />
      )}
    </section>
  );
}

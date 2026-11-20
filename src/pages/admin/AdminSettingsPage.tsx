import { Save } from 'lucide-react';
import { useState } from 'react';
import { Field } from '../../components/Field';
import { PageHeader } from '../../components/PageHeader';
import { PendingAction } from '../../components/PendingAction';
import { VideoBlock } from '../../components/VideoBlock';
import { courseInfo } from '../../data/course';
import { ACCESS_DAYS } from '../../lib/access';
import { parseYouTubeId } from '../../lib/validation';

export function AdminSettingsPage() {
  const [videoUrl, setVideoUrl] = useState(courseInfo.introVideoUrl ?? '');
  const trimmed = videoUrl.trim();
  const videoError = trimmed && !parseYouTubeId(trimmed) ? 'Не похоже на ссылку YouTube. Пример: https://youtu.be/xxxxxxxxxxx' : null;

  return (
    <>
      <PageHeader title="Настройки" subtitle="Информация о курсе и вводное видео." />
      <div className="two-col">
        <section className="card" aria-labelledby="course-title">
          <h2 id="course-title" className="card__title">
            Информация о курсе
          </h2>
          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <Field id="course-name" label="Заголовок на главной" defaultValue={courseInfo.tagline} />
            <div className="field">
              <label className="field__label" htmlFor="course-description">
                Описание
              </label>
              <textarea id="course-description" className="input textarea" rows={4} defaultValue={courseInfo.description} />
            </div>
            <Field
              id="course-video"
              label="Ссылка на вводное видео (YouTube)"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              error={videoError}
            />
            <Field id="course-days" label="Срок доступа, дней" type="number" value={courseInfo.accessDays} readOnly hint={`Срок обучения: ${ACCESS_DAYS} дней с момента активации администратором.`} />
            <div className="form__actions">
              <PendingAction label="Сохранить" icon={Save} variant="primary" />
            </div>
          </form>
        </section>

        <section className="card" aria-labelledby="preview-title">
          <h2 id="preview-title" className="card__title">
            Предпросмотр видео
          </h2>
          <VideoBlock
            url={trimmed && !videoError ? trimmed : null}
            title="Вводное видео о курсе"
            note="Укажите корректную ссылку YouTube, чтобы увидеть предпросмотр."
          />
        </section>
      </div>
    </>
  );
}

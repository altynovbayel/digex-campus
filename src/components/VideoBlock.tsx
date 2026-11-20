import { ExternalLink, PlayCircle } from 'lucide-react';
import { parseYouTubeId } from '../lib/validation';

interface Props {
  url: string | null;
  title: string;
  /** Дополнительное пояснение под заглушкой. */
  note?: string;
}

/**
 * Видео урока. Открывается на YouTube в новой вкладке — без встраивания и автозапуска.
 * Без ссылки — заглушка «Видео скоро появится» без кнопок.
 */
export function VideoBlock({ url, title, note }: Props) {
  const id = url ? parseYouTubeId(url) : null;

  if (!url || !id) {
    const message = url && !id ? 'Ссылка на видео указана некорректно' : 'Видео скоро появится';
    return (
      <div className="video video--placeholder" role="img" aria-label={`${title}: ${message}`}>
        <PlayCircle size={44} aria-hidden="true" />
        <p className="video__title">{message}</p>
        {note && <p className="video__text">{note}</p>}
      </div>
    );
  }

  return (
    <div className="video video--placeholder video--link">
      <PlayCircle size={44} aria-hidden="true" />
      <p className="video__title">Видео к уроку на YouTube</p>
      <a className="btn btn--primary" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer noopener">
        Смотреть на YouTube <ExternalLink size={16} aria-hidden="true" />
        <span className="sr-only"> (откроется в новой вкладке)</span>
      </a>
    </div>
  );
}

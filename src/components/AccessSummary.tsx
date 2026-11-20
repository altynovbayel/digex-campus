import { formatDateTime } from '../lib/format';
import type { CourseAccess } from '../types';
import { AccessBadge } from './StatusBadges';

/** Общий доступ к курсу: статус и даты периода (одни на все разделы). */
export function AccessSummary({ access }: { access: CourseAccess }) {
  return (
    <div className="access-list">
      <span className="access-list__head">
        <strong>Курс: Claude и ChatGPT</strong>
        <AccessBadge status={access.status} />
      </span>
      {access.startsAt && access.endsAt ? (
        <span className="access-list__dates">
          {formatDateTime(access.startsAt)} — {formatDateTime(access.endsAt)}
        </span>
      ) : (
        <span className="access-list__dates">Доступ откроется после подтверждения оплаты</span>
      )}
    </div>
  );
}

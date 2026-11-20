import { Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDateTime } from '../lib/format';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';

/** Строка результата: попытка теста (баллы посчитаны базой, названия — снимок на момент отправки). */
export interface ResultRow {
  id: string;
  lessonTitle: string;
  sectionTitle: string;
  submittedAt: string;
  correct: number;
  total: number;
  percent: number;
  studentName?: string;
  studentEmail?: string | null;
}

interface Props {
  rows: ResultRow[];
  caption: string;
  /** Показывать колонку «Ученик» (админка). */
  showStudent?: boolean;
  emptyText: string;
  emptyAction?: ReactNode;
}

export function ResultsTable({ rows, caption, showStudent = false, emptyText, emptyAction }: Props) {
  if (rows.length === 0) {
    return <EmptyState icon={Target} title={emptyText} action={emptyAction} />;
  }
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Дата</th>
            {showStudent && <th scope="col">Ученик</th>}
            <th scope="col">Раздел</th>
            <th scope="col">Урок</th>
            <th scope="col">Баллы</th>
            <th scope="col">Результат</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap muted">{formatDateTime(r.submittedAt)}</td>
              {showStudent && (
                <td>
                  {r.studentName}
                  {r.studentEmail && <div className="muted small">{r.studentEmail}</div>}
                </td>
              )}
              <td className="muted">{r.sectionTitle}</td>
              <td>{r.lessonTitle}</td>
              <td className="nowrap">
                {r.correct} из {r.total}
              </td>
              <td>
                <Badge tone={r.percent >= 70 ? 'success' : r.percent >= 40 ? 'warning' : 'danger'}>{r.percent}%</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

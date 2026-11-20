/** ТОЛЬКО ДЛЯ РЕЖИМА РАЗРАБОТКИ: таблица вымышленных учеников. */
import { CheckCircle2, Users } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { PendingAction } from '../components/PendingAction';
import { AccessBadge, PaymentBadge } from '../components/StatusBadges';
import { getAccessStatus } from '../lib/access';
import { formatDate } from '../lib/format';
import { demoStudents } from './people';

export function DemoStudentsTable() {
  return (
    <section className="card" aria-label="Список учеников">
      {demoStudents.length === 0 ? (
        <EmptyState icon={Users} title="Учеников пока нет" text="Они появятся здесь после регистрации." />
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Ученики">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Ученик</th>
                <th scope="col">Оплата</th>
                <th scope="col">Доступ</th>
                <th scope="col">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {demoStudents.map((s) => {
                const status = getAccessStatus(s.access);
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="muted small">{s.email}</div>
                    </td>
                    <td>
                      <PaymentBadge status={s.paymentStatus} />
                    </td>
                    <td>
                      <AccessBadge status={status} />
                      {s.access.expiresAt && (
                        <div className="muted small nowrap">до {formatDate(s.access.expiresAt)}</div>
                      )}
                    </td>
                    <td className="table__actions">
                      {status !== 'active' && (
                        <PendingAction label="Активировать" icon={CheckCircle2} variant="ghost" compact reason="Скоро" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

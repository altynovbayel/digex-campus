import { CalendarClock, ReceiptText, ShieldCheck, Wallet } from 'lucide-react';
import { useCabinet } from '../../cabinet/useCabinet';
import { AccessSummary } from '../../components/AccessSummary';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { PeriodBadge } from '../../components/StatusBadges';
import { courseInfo } from '../../data/course';
import { ACCESS_DAYS } from '../../lib/access';
import { formatDateTime, formatSom } from '../../lib/format';

const STEPS = [
  { icon: Wallet, title: 'Оплата', text: 'Оплатите обучение по реквизитам, которые предоставит администратор.' },
  {
    icon: ShieldCheck,
    title: 'Подтверждение',
    text: 'Администратор вручную проверит оплату, укажет сумму и активирует доступ ко всему курсу.',
  },
  {
    icon: CalendarClock,
    title: `${ACCESS_DAYS} дней доступа`,
    text: `Оба раздела — Claude и ChatGPT — открыты ${ACCESS_DAYS} дней с момента активации. После окончания профиль, история оплаты и результаты сохраняются.`,
  },
] as const;

export function PaymentPage() {
  const { access, payments } = useCabinet();

  return (
    <>
      <PageHeader
        eyebrow="Оплата обучения"
        title="Оплата"
        subtitle="Онлайн-оплаты на сайте нет — оплату подтверждает администратор."
      />

      <div className="two-col">
        <section className="card" aria-labelledby="pay-status-title">
          <h2 id="pay-status-title" className="card__title">
            Доступ к курсу
          </h2>
          <AccessSummary access={access} />
          <dl className="info-list">
            <div>
              <dt>Стоимость</dt>
              <dd>{courseInfo.priceLabel ?? 'Уточните у администратора'}</dd>
            </div>
          </dl>
        </section>

        <section className="card" aria-labelledby="how-title">
          <h2 id="how-title" className="card__title">
            Как это работает
          </h2>
          <ol className="steps">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="steps__item">
                <span className="steps__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <span className="muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card" aria-labelledby="history-title">
        <h2 id="history-title" className="card__title">
          История оплат
        </h2>
        {payments.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Подтверждённых оплат пока нет" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="История оплат">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Подтверждено</th>
                  <th scope="col">Сумма</th>
                  <th scope="col">Период доступа</th>
                  <th scope="col">Статус</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{formatDateTime(p.confirmedAt)}</td>
                    <td className="nowrap">{formatSom(p.amountSom)}</td>
                    <td className="muted small">
                      {formatDateTime(p.startsAt)} — {formatDateTime(p.endsAt)}
                    </td>
                    <td>
                      <PeriodBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import { CalendarX2, Lock, ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACCESS_DAYS } from '../lib/access';
import { formatDateTime } from '../lib/format';
import type { CourseAccess } from '../types';

/** Почему материалы курса закрыты: доступ не активирован, истёк или отозван. Касается всех разделов. */
export function AccessLocked({ access, idSuffix = 'course' }: { access: CourseAccess; idSuffix?: string }) {
  const content = (() => {
    switch (access.status) {
      case 'expired':
        return {
          Icon: CalendarX2,
          title: 'Срок доступа закончился',
          text: `Доступ ко всем разделам действовал ${ACCESS_DAYS} дней — до ${formatDateTime(access.endsAt)}. Уроки и тесты закрыты, профиль, история оплаты и результаты сохранены.`,
        };
      case 'revoked':
        return {
          Icon: ShieldOff,
          title: 'Доступ отозван администратором',
          text: `Доступ ко всем разделам закрыт ${formatDateTime(access.revokedAt)}. История оплаты сохранена. По вопросам обратитесь к администратору.`,
        };
      default:
        return {
          Icon: Lock,
          title: 'Доступ откроется после подтверждения оплаты',
          text: `Одна оплата открывает все разделы курса на ${ACCESS_DAYS} дней с момента активации администратором.`,
        };
    }
  })();
  const { Icon } = content;
  const titleId = `locked-${idSuffix}`;
  return (
    <section className="card locked" aria-labelledby={titleId}>
      <span className="locked__icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <h2 id={titleId} className="locked__title">
        {content.title}
      </h2>
      <p className="locked__text">{content.text}</p>
      <div className="locked__actions">
        <Link to="/payment" className="btn btn--primary">
          Об оплате
        </Link>
        <Link to="/profile" className="btn btn--secondary">
          Мой профиль
        </Link>
      </div>
    </section>
  );
}

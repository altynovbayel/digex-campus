import { ACCESS_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../lib/access';
import type { AccessStatus, PaymentStatus } from '../types';
import { Badge, type BadgeTone } from './Badge';

const ACCESS_TONE: Record<AccessStatus, BadgeTone> = {
  not_activated: 'warning',
  active: 'success',
  expired: 'danger',
  revoked: 'danger',
  archived: 'neutral',
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  unpaid: 'warning',
  pending: 'accent',
  paid: 'success',
};

/** Короткие подписи для периода оплаты в истории. */
const PERIOD_LABEL: Record<AccessStatus, string> = {
  not_activated: 'Ещё не начался',
  active: 'Действует',
  expired: 'Истёк',
  revoked: 'Отозван',
  archived: 'Раздел в архиве',
};

export function AccessBadge({ status }: { status: AccessStatus }) {
  return <Badge tone={ACCESS_TONE[status]}>{ACCESS_STATUS_LABEL[status]}</Badge>;
}

export function PeriodBadge({ status }: { status: AccessStatus }) {
  return <Badge tone={ACCESS_TONE[status]}>{PERIOD_LABEL[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

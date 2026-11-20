import type { AccessPeriod, AccessStatus, PaymentStatus } from '../types';

export const ACCESS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Определяет статус доступа по датам. Используется только для отображения:
 * в рабочей версии ограничение проверяется на сервере и в базе данных.
 */
export function getAccessStatus(access: AccessPeriod, now: Date = new Date()): AccessStatus {
  if (!access.activatedAt || !access.expiresAt) return 'not_activated';
  return new Date(access.expiresAt).getTime() > now.getTime() ? 'active' : 'expired';
}

export function getDaysLeft(access: AccessPeriod, now: Date = new Date()): number {
  if (!access.expiresAt) return 0;
  const diff = new Date(access.expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  not_activated: 'Доступ к обучению не активирован',
  active: 'Доступ активен',
  expired: 'Срок доступа истёк',
  revoked: 'Доступ отозван',
  archived: 'Раздел в архиве',
};


export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Не оплачено',
  pending: 'Ожидает подтверждения',
  paid: 'Оплачено',
};

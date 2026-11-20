/**
 * ТОЛЬКО ДЛЯ РЕЖИМА РАЗРАБОТКИ: вымышленные ученики, результаты и оплаты для админки в демо-режиме.
 */
import { ACCESS_DAYS, addDays } from '../lib/access';
import type { AttemptRecord, Student } from '../types';

const now = new Date();

/** Ученики для таблиц админки. */
export const demoStudents: Student[] = [
  {
    id: 's-101',
    name: 'Алина Смирнова',
    email: 'alina@example.com',
    groupIds: ['claude'],
    paymentStatus: 'paid',
    access: { activatedAt: addDays(now, -4).toISOString(), expiresAt: addDays(now, ACCESS_DAYS - 4).toISOString() },
  },
  {
    id: 's-102',
    name: 'Тимур Ахмедов',
    email: 'timur@example.com',
    groupIds: ['chatgpt'],
    paymentStatus: 'pending',
    access: { activatedAt: null, expiresAt: null },
  },
  {
    id: 's-103',
    name: 'Мария Ким',
    email: 'maria@example.com',
    groupIds: ['claude', 'chatgpt'],
    paymentStatus: 'paid',
    access: { activatedAt: addDays(now, -20).toISOString(), expiresAt: addDays(now, ACCESS_DAYS - 20).toISOString() },
  },
  {
    id: 's-104',
    name: 'Даниил Орлов',
    email: 'daniil@example.com',
    groupIds: [],
    paymentStatus: 'unpaid',
    access: { activatedAt: null, expiresAt: null },
  },
];

/** Результатов пока нет: начальный прогресс — 0. */
export const demoResults: AttemptRecord[] = [];



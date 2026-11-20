export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

/** Колонки, которые клиент читает из public.profiles. */
export const PROFILE_COLUMNS = 'id, full_name, role, created_at';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Проверяет строку из базы и приводит к типу Profile. */
export function parseProfile(row: unknown): Profile | null {
  if (!isRecord(row)) return null;
  const { id, full_name, role, created_at } = row;
  if (typeof id !== 'string' || typeof full_name !== 'string' || typeof created_at !== 'string') return null;
  if (role !== 'student' && role !== 'admin') return null;
  return { id, fullName: full_name, role, createdAt: created_at };
}

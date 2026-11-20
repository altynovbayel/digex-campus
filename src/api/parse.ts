/** Проверка ответов базы без any: неверная форма данных — ошибка, а не тихая подстановка. */

export class ParseError extends Error {
  constructor(what: string) {
    super(`Неожиданный ответ сервера: ${what}`);
    this.name = 'ParseError';
  }
}

export type Rec = Record<string, unknown>;

export function rec(v: unknown, what: string): Rec {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ParseError(what);
  return v as Rec;
}

export function arr(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new ParseError(what);
  return v;
}

export function str(r: Rec, key: string): string {
  const v = r[key];
  if (typeof v !== 'string') throw new ParseError(key);
  return v;
}

export function strOrNull(r: Rec, key: string): string | null {
  const v = r[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new ParseError(key);
  return v;
}

export function num(r: Rec, key: string): number {
  const v = r[key];
  // numeric из PostgreSQL может прийти строкой.
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ParseError(key);
  return n;
}

export function bool(r: Rec, key: string): boolean {
  const v = r[key];
  if (typeof v !== 'boolean') throw new ParseError(key);
  return v;
}

const STATUSES = ['not_activated', 'active', 'expired', 'revoked', 'archived'] as const;
export type ParsedStatus = (typeof STATUSES)[number];

export function status(r: Rec, key: string): ParsedStatus {
  const v = r[key];
  const found = STATUSES.find((s) => s === v);
  if (!found) throw new ParseError(key);
  return found;
}

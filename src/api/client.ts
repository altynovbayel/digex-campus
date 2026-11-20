import { DB_TIMEOUT_MS, dbErrorMessage } from '../auth/errors';
import { supabase } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Ошибка запроса с уже понятным пользователю текстом. */
export class ApiError extends Error {
  /** Исходный код ошибки базы (например, quiz_changed) — для логики интерфейса. */
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function db(): SupabaseClient {
  if (!supabase) throw new ApiError('Подключение к Supabase не настроено.');
  return supabase;
}

export const timeout = () => AbortSignal.timeout(DB_TIMEOUT_MS);

interface DbResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

/** Выполняет запрос и разбирает ответ; любая ошибка — ApiError с понятным текстом. */
export async function run<T>(query: PromiseLike<DbResult>, parse: (data: unknown) => T): Promise<T> {
  let result: DbResult;
  try {
    result = await query;
  } catch (e) {
    throw new ApiError(dbErrorMessage({ message: e instanceof Error ? e.message : String(e) }));
  }
  if (result.error) throw new ApiError(dbErrorMessage(result.error), result.error.message?.trim() ?? null);
  try {
    return parse(result.data);
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'Неожиданный ответ сервера.');
  }
}

export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}

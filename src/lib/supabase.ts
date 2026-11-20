import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

function looksLikeSecret(value: string): boolean {
  // Секретный ключ никогда не должен попадать в браузер.
  if (value.startsWith('sb_secret_')) return true;
  if (value.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(value.split('.')[1] ?? '')) as { role?: unknown };
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export type SupabaseConfigProblem = 'missing' | 'secret_key' | 'invalid_url';

function detectProblem(): SupabaseConfigProblem | null {
  if (!url || !key) return 'missing';
  if (looksLikeSecret(key)) return 'secret_key';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return 'invalid_url';
  } catch {
    return 'invalid_url';
  }
  return null;
}

export const supabaseConfigProblem = detectProblem();

/**
 * Ошибка из ссылки письма (например, ссылка устарела). Читается до того,
 * как клиент Supabase обработает адрес страницы.
 */
function readUrlError(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  const code = params.get('error_code') ?? search.get('error_code');
  const description = params.get('error_description') ?? search.get('error_description');
  if (!code && !description) return null;
  if (code === 'otp_expired') return 'Ссылка из письма устарела или уже была использована. Запросите новое письмо.';
  return 'Не удалось обработать ссылку из письма. Попробуйте запросить новое письмо.';
}

export const initialLinkError = readUrlError();

/**
 * Страница открыта по ссылке восстановления пароля (implicit flow: #...&type=recovery).
 * Читается при загрузке модуля: событие PASSWORD_RECOVERY может прийти раньше,
 * чем React успеет подписаться на изменения авторизации.
 */
function readRecoveryLink(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('type') === 'recovery' && params.has('access_token');
}

export const initialRecoveryLink = readRecoveryLink();

/** null — Supabase не настроен; приложение покажет инструкцию, а не демо-данные. */
export const supabase: SupabaseClient | null =
  supabaseConfigProblem === null
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // implicit: ссылки из писем работают, даже если открыты в другом браузере.
          flowType: 'implicit',
        },
      })
    : null;

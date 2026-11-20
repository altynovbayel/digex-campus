import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** Роль из полезной нагрузки JWT (устаревшие ключи Supabase). null — не JWT. */
function jwtRole(value: string): string | null {
  const payload = value.split('.')[1];
  if (!value.startsWith('eyJ') || !payload) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data === 'object' && data !== null && 'role' in data && typeof data.role === 'string') return data.role;
  } catch {
    return null;
  }
  return null;
}

/** Есть ли в значении (в том числе внутри строки вида «Bearer …» или JSON) JWT с ролью service_role. */
function containsServiceRoleJwt(value: string): boolean {
  const candidates = value.match(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*)?/g) ?? [];
  return candidates.some((jwt) => jwtRole(jwt) === 'service_role');
}

/**
 * Всё, что начинается с VITE_, Vite вставляет в клиентский JavaScript.
 * Поэтому секретный ключ нужно остановить ДО запуска dev-сервера и сборки.
 * Значения переменных в сообщениях не выводятся.
 */
function assertPublicEnv(env: Record<string, string>): void {
  for (const [name, raw] of Object.entries(env)) {
    const value = raw.trim();
    if (!value) continue;
    if (value.includes('sb_secret_') || containsServiceRoleJwt(value)) {
      throw new Error(
        `${name}: обнаружен СЕКРЕТНЫЙ ключ Supabase. Он попал бы в браузерный код. ` +
          'Удалите его из .env-файлов, укажите publishable-ключ и перевыпустите секретный ключ в панели Supabase.',
      );
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (key && !key.startsWith('sb_publishable_') && jwtRole(key) !== 'anon') {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY: ожидается publishable-ключ (sb_publishable_…) или устаревший anon-ключ.',
    );
  }
}

export default defineConfig(({ mode }) => {
  assertPublicEnv(loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [react()],
    server: { port: 5173 },
  };
});

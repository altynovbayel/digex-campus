import type { SupabaseConfigProblem } from '../lib/supabase';
import { Alert } from './Alert';

/** Подсказка для разработчика, если Supabase не настроен. Ключи не запрашиваются. */
export function SetupNotice({ problem }: { problem: SupabaseConfigProblem }) {
  if (problem === 'secret_key') {
    return (
      <Alert tone="error">
        <p>
          <strong>В VITE_SUPABASE_PUBLISHABLE_KEY указан секретный ключ.</strong> Такой ключ нельзя использовать в
          браузере. Замените его на publishable-ключ (sb_publishable_…) и перевыпустите секретный ключ в панели Supabase.
        </p>
      </Alert>
    );
  }
  return (
    <Alert tone="error">
      <p>
        <strong>Подключение к Supabase не настроено.</strong>{' '}
        {problem === 'invalid_url' ? 'Адрес VITE_SUPABASE_URL указан некорректно. ' : ''}
        Скопируйте <code>.env.example</code> в <code>.env.local</code>, укажите URL проекта и publishable-ключ и
        перезапустите <code>npm run dev</code>. Подробности — в README.
      </p>
    </Alert>
  );
}

import { initialLinkError, initialRecoveryLink } from '../lib/supabase';

/**
 * Признак незавершённого восстановления пароля в пределах вкладки (sessionStorage).
 * Нужен, чтобы перезагрузка /reset-password не теряла начатое восстановление.
 * Ограничен по времени; очищается после смены пароля и при выходе.
 */
const KEY = 'digex-password-recovery';
const TTL_MS = 60 * 60 * 1000;

export function storeRecovery(active: boolean): void {
  try {
    if (active) window.sessionStorage.setItem(KEY, String(Date.now()));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Хранилище недоступно — признак живёт только в памяти.
  }
}

function readStoredRecovery(): boolean {
  try {
    const startedAt = Number(window.sessionStorage.getItem(KEY));
    return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < TTL_MS;
  } catch {
    return false;
  }
}

/** Начальное значение при загрузке страницы. Ошибка в ссылке сбрасывает признак. */
export function initialRecoveryState(): boolean {
  if (initialLinkError) {
    storeRecovery(false);
    return false;
  }
  if (initialRecoveryLink) {
    storeRecovery(true);
    return true;
  }
  return readStoredRecovery();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Укажите email.';
  if (!EMAIL_RE.test(v)) return 'Введите корректный email, например name@example.com.';
  return null;
}

export function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Укажите имя.';
  if (v.length < 2) return 'Имя должно содержать минимум 2 символа.';
  return null;
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(value: string): string | null {
  if (!value) return 'Придумайте пароль.';
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`;
  }
  return null;
}

/** Возвращает id видео YouTube или null, если ссылка не распознана. */
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
        id = m?.[2] ?? null;
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

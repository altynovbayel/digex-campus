const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const somFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Дата и время в часовом поясе пользователя, например «18 ноября 2026 г., 14:05». */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeFormatter.format(new Date(iso));
}

export function formatSom(amount: number): string {
  return `${somFormatter.format(amount)} сом`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return dateFormatter.format(new Date(iso));
}

export function percent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function pluralize(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

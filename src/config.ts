/**
 * Режим работы приложения.
 * Демо-режим доступен только в dev-сервере и только при явном VITE_DEMO_MODE=true.
 * В production-сборке он всегда выключен.
 */
export const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';

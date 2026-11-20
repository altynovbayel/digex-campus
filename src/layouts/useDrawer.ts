import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Мобильная ширина — как в стилях: `below($bp-md)` с `$bp-md: 960px` даёт `max-width: 959px`
 * (src/styles/_tokens.scss). На большей ширине боковая панель всегда видна, а кнопки меню скрыты.
 */
const MOBILE_QUERY = '(max-width: 959px)';

/** Элемент реально отображается (не display: none и не внутри скрытого родителя). */
function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/** Состояние выдвижной панели навигации на телефоне. */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);

  // Закрываем панель при переходе на другую страницу.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Переход на десктопную ширину закрывает панель: снимаются inert, затемнение и удержание фокуса.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Пока панель открыта: Escape закрывает её, Tab и Shift+Tab не выпускают фокус за пределы панели.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => isVisible(el) || el === document.activeElement,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Фокус: при открытии — в панель; при закрытии — на кнопку меню, если она видна.
  // Если кнопка скрыта (панель закрыта переходом на десктоп), фокус остаётся на видимом элементе
  // или переходит на первый видимый элемент панели — но не на скрытую кнопку.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const opener = openerRef.current;
    if (opener && isVisible(opener)) {
      opener.focus();
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && isVisible(active)) return;
    const fallback = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).find(isVisible)
      : undefined;
    fallback?.focus();
  }, [open]);

  return { open, setOpen, openerRef, closeRef, panelRef };
}

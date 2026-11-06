"use client";

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Houdt de toetsenbordfocus binnen een venster: focus gaat erin bij openen, Tab/Shift+Tab blijven
 * binnen het venster, Escape roept onEscape aan, en bij sluiten krijgt het vorige element de focus terug.
 *
 * Geeft een ref en een onKeyDown-handler terug. De handler is een React-event, zodat een veld binnen
 * het venster (zoals de adreslijst) Escape zelf kan afvangen met stopPropagation.
 */
export function useFocusTrap<T extends HTMLElement>(onEscape?: () => void, initialFocus: "first-field" | "container" = "first-field") {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;
    const first =
      initialFocus === "container"
        ? container
        : container.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled])") ??
          container.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => previous?.focus?.();
    // Alleen bij openen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    },
    [onEscape]
  );

  return { ref, onKeyDown };
}

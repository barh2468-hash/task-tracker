import { useEffect, useRef } from 'react';

// Keep keyboard interaction inside a project dialog and return to its trigger.
export default function useProjectDialog(open, onEscape, initialFocusRef) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onEscape);
  useEffect(() => {
    closeRef.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const focusable = () =>
      [
        ...dialog.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length > 0);
    (initialFocusRef?.current || focusable()[0])?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);
  return dialogRef;
}

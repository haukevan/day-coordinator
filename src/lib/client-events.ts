/**
 * Small typed browser event bus for cross-component updates that are not
 * captured by router refresh (for example an optimistically inserted card).
 *
 * These helpers are no-ops during server rendering.
 */

export const EVENT_DUPLICATED = "dayco:event-duplicated";

export function emitEventDuplicated<T>(event: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(EVENT_DUPLICATED, { detail: event }));
}

export function onEventDuplicated<T>(
  handler: (event: T) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (e: Event) => {
    handler((e as CustomEvent<T>).detail);
  };
  window.addEventListener(EVENT_DUPLICATED, listener);
  return () => window.removeEventListener(EVENT_DUPLICATED, listener);
}

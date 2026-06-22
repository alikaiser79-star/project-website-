/* Small typed event bus used by Spotlight to ask the App to open a
   specific overlay or focus a panel. Keeps Spotlight free of refs to
   App-owned state. */

export type KaiAction =
  | { type: 'open-journal'; entryId?: string }
  | { type: 'open-settings'; section?: string }   // section title to scroll to
  | { type: 'open-cmd'; prefill?: string; submit?: boolean }
  | { type: 'ping-panel'; panel: string }          // data-panel value to flash
  | { type: 'open-brain-dump'; prefill?: string }
  | { type: 'open-receipt'; draft?: unknown };     // pre-filled ReceiptConfirm draft

type Listener = (a: KaiAction) => void;
const listeners = new Set<Listener>();

export function emitAction(a: KaiAction) {
  listeners.forEach(fn => fn(a));
}
export function onAction(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

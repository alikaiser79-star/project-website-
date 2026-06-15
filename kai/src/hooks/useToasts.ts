import { useEffect, useState } from 'react';

export type ToastLevel = 'ok' | 'warn' | 'err';
export type Toast = { id: string; title: string; body: string; level: ToastLevel; ttl: number };

type Listener = (t: Toast[]) => void;
const listeners = new Set<Listener>();
let toasts: Toast[] = [];

function emit() { listeners.forEach(fn => fn(toasts.slice())); }

export function pushToast(t: Omit<Toast, 'id'>) {
  const id = 't-' + Math.random().toString(36).slice(2, 9);
  const full: Toast = { id, ...t };
  toasts = [...toasts, full];
  emit();
  if (t.ttl > 0) setTimeout(() => dismissToast(id), t.ttl);
  return id;
}
export function dismissToast(id: string) {
  toasts = toasts.filter(x => x.id !== id);
  emit();
}

export function useToasts() {
  const [arr, setArr] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setArr);
    return () => { listeners.delete(setArr); };
  }, []);
  return arr;
}

/* Convenience helpers */
export const toast = {
  ok:   (body: string, title = 'EVENT', ttl = 4400)  => pushToast({ body, title, level: 'ok',   ttl }),
  warn: (body: string, title = 'NOTICE', ttl = 5200) => pushToast({ body, title, level: 'warn', ttl }),
  err:  (body: string, title = 'ALERT', ttl = 6000)  => pushToast({ body, title, level: 'err',  ttl }),
};

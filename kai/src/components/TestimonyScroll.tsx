/* ============================================================
   THE TESTIMONY SCROLL — your month as one column of gold lines.

   Reveal by swiping down on the mobile hero. Each entry is a day's
   witness line; the newest is at the top. Read-only, dismissible.
   ============================================================ */

import { getScroll } from '../lib/kai/witness';

interface Props { onClose: () => void; }

function label(date: string): string {
  try {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return date; }
}

export default function TestimonyScroll({ onClose }: Props) {
  const entries = getScroll();
  return (
    <div className="kai-scroll" onClick={onClose} role="button" aria-label="close the testimony scroll">
      <div className="kai-scroll-head">
        <span className="kai-scroll-title">THE WITNESS · LAST {entries.length || 0} DAYS</span>
        <span className="kai-scroll-x">✕</span>
      </div>
      <div className="kai-scroll-body" onClick={(e) => e.stopPropagation()}>
        {entries.length === 0 && (
          <div className="kai-scroll-empty">No testimony yet. The Witness speaks once a day.</div>
        )}
        {entries.map((e) => (
          <div key={e.date} className="kai-scroll-row">
            <span className="kai-scroll-date">{label(e.date)}</span>
            <span className="kai-scroll-line">{e.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

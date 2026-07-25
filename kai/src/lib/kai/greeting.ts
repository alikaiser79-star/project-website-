/* ============================================================
   THE GREETING — KAI speaks first. On open, before anything else, one line
   of gold generated from what ACTUALLY changed since the last open — a real
   diff over the Spine, not a summary. If nothing changed, KAI says nothing:
   silence is a feature.

   Pure Spine arithmetic + the Makadi profit read. No fabrication. Grounded
   in real events between the previous open and now.
   ============================================================ */

import { getEvents } from './events';
import { makadiProfit } from './makadiProfit';

const SEEN = 'kai.greeting.lastOpen';
const MIN_GAP = 90_000;   // re-opening within 90s isn't "away" — stay silent

export interface Greeting { line: string; since: number; }

function lastOpen(): number { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } }
function markOpened(now: number) { try { localStorage.setItem(SEEN, String(now)); } catch { /* ignore */ } }

const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const numWord = (n: number) => (n < NUM.length ? NUM[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Build the greeting from the diff since the previous open. Marks THIS open
   so the next one diffs from here. Returns null (silence) when nothing
   meaningful changed. */
export function buildGreeting(now = Date.now()): Greeting | null {
  const since = lastOpen();
  markOpened(now);
  if (!since || now - since < MIN_GAP) return null;   // first ever open, or a quick re-open

  const evs = getEvents({ since });
  if (!evs.length) return null;

  const bookings = evs.filter((e) => e.domain === 'makadi' && e.type === 'booking_confirmed');
  const broken   = evs.filter((e) => e.domain === 'commitment' && e.type === 'commitment_broken');
  const kept     = evs.filter((e) => e.domain === 'commitment' && e.type === 'commitment_kept');
  const paid     = evs.filter((e) => e.domain === 'debt' && e.type === 'payment_logged').reduce((s, e) => s + (e.value || 0), 0);
  const plants   = evs.filter((e) => e.domain === 'garden' && e.type === 'plant_added');
  const inquiries = evs.filter((e) => (e.domain === 'makadi' || e.domain === 'leads') && e.type === 'booking_inquiry');
  const bigRadar = evs.filter((e) => e.domain === 'radar' && e.type === 'finding' && (e.meta as any)?.big);

  const parts: string[] = [];

  /* Headline — the single most significant change, in KAI's voice. */
  if (bookings.length) {
    parts.push(bookings.length === 1
      ? 'A booking landed while you were away.'
      : `${cap(numWord(bookings.length))} bookings landed while you were away.`);
    const p = makadiProfit(now);
    if (p.spent > 0) {
      parts.push(p.brokeEven
        ? `Makadi has paid for itself — ${egp(p.net)} EGP clear.`
        : `Makadi is ${egp(p.earned)} EGP toward the ${egp(p.spent)} you spent.`);
    }
  } else if (broken.length) {
    parts.push(`You broke a commitment while you were gone: ${String((broken[0].meta as any)?.text || 'one of your own')}.`);
  } else if (kept.length) {
    parts.push(`Kept your word: ${String((kept[0].meta as any)?.text || 'a commitment')}.`);
  } else if (inquiries.length) {
    parts.push(inquiries.length === 1 ? 'A booking inquiry came in — it needs an answer.' : `${cap(numWord(inquiries.length))} booking inquiries came in.`);
  } else if (paid > 0) {
    parts.push(`You put ${egp(paid)} EGP on the card since you left.`);
  } else if (bigRadar.length) {
    parts.push(`Radar caught something big: ${String((bigRadar[0].meta as any)?.summary || 'a market move')}.`);
  } else if (plants.length) {
    parts.push(`${plants.length} new plant${plants.length === 1 ? '' : 's'} in the garden.`);
  } else {
    return null;   // nothing worth speaking → silence
  }

  return { line: parts.join(' '), since };
}

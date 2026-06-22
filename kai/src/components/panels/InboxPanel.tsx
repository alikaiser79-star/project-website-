/* ============================================================
   InboxPanel — read-only Gmail digest.

   Lives on the dashboard so Ali can see what landed without
   leaving the app. Fetches /api/gmail/list (read-only,
   server-side credentials). Empty / no-creds / error states
   each have a distinct nudge.

   Replying goes through ⌘K → propose_email → ConfirmationGate.
   This panel never sends.
   ============================================================ */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, RefreshCw, Loader2, AlertTriangle, Inbox } from 'lucide-react';
import Panel from '../Panel';
import { sfx } from '../../lib/sound';
import { operator } from '../../kaiConfig';

interface MailRow {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'no_creds' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; messages: MailRow[]; fetchedAt: number };

export default function InboxPanel({ delay = 0 }: { delay?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [query, setQuery] = useState('in:inbox newer_than:3d');

  async function load(q = query) {
    setState({ kind: 'loading' });
    try {
      const r = await fetch('/api/gmail/list?q=' + encodeURIComponent(q));
      const data = await r.json().catch(() => ({}));
      if (r.status === 503 && data?.error === 'no_gmail_creds') {
        setState({ kind: 'no_creds' });
        return;
      }
      if (!r.ok) {
        setState({ kind: 'error', message: String(data?.message || `http ${r.status}`) });
        return;
      }
      const messages: MailRow[] = Array.isArray(data?.messages) ? data.messages : [];
      setState({ kind: 'ok', messages, fetchedAt: Date.now() });
    } catch (e: any) {
      setState({ kind: 'error', message: String(e?.message || 'fetch failed') });
    }
  }

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const tag =
    state.kind === 'loading'  ? 'loading…' :
    state.kind === 'no_creds' ? 'not connected' :
    state.kind === 'error'    ? 'error' :
    state.kind === 'ok'       ? `${state.messages.length} msg` :
                                '';

  return (
    <Panel num="13" title="Inbox" tag={tag} delay={delay}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail size={11} className="text-amber/75" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { sfx.click(); load(query); } }}
            className="flex-1 bg-transparent border border-amber/15 focus:border-amber rounded px-2 py-1 text-bone font-mono text-[10.5px] outline-none"
          />
          <button
            onClick={() => { sfx.click(); load(query); }}
            className="p-1 text-steel hover:text-amber transition"
            title="Refresh"
            disabled={state.kind === 'loading'}
          >
            {state.kind === 'loading'
              ? <Loader2 size={11} className="animate-spin" />
              : <RefreshCw size={11} />}
          </button>
        </div>

        {state.kind === 'no_creds' && (
          <div className="px-3 py-3 border border-amber/20 rounded bg-amber/[0.04] text-bone/85 text-[11.5px] leading-relaxed">
            <strong className="text-amber font-medium">Gmail isn't connected yet.</strong>
            <p className="mt-1 text-steel">
              Set <span className="text-amber/85 font-mono text-[10.5px]">GOOGLE_CLIENT_ID</span>,
              {' '}<span className="text-amber/85 font-mono text-[10.5px]">GOOGLE_CLIENT_SECRET</span>, and
              {' '}<span className="text-amber/85 font-mono text-[10.5px]">GOOGLE_REFRESH_TOKEN</span> in
              Vercel project env. Scopes: gmail.readonly + gmail.send.
            </p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="px-3 py-2 border border-danger/30 rounded bg-danger/[0.05] text-danger text-[11.5px] flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <div className="flex-1">{state.message}</div>
            <button onClick={() => load(query)} className="text-amber hover:underline shrink-0">retry</button>
          </div>
        )}

        {state.kind === 'ok' && state.messages.length === 0 && (
          <div className="px-3 py-4 border border-amber/15 rounded text-center">
            <Inbox size={18} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12px]">Nothing matches that filter.</p>
          </div>
        )}

        {state.kind === 'ok' && state.messages.length > 0 && (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {state.messages.map(m => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="px-2.5 py-2 border border-amber/10 rounded hover:border-amber/30 transition"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-bone text-[12.5px] truncate flex-1 min-w-0">
                      {m.subject || '(no subject)'}
                    </span>
                    <span className="font-mono text-[9.5px] text-steel/70 shrink-0">{relDate(m.date)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-steel/85 truncate mt-0.5">{stripName(m.from)}</div>
                  {m.snippet && (
                    <div className="font-sans text-[11.5px] text-bone/75 leading-snug mt-1 line-clamp-2">
                      {m.snippet}
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <p className="font-mono text-[9.5px] text-steel/60 leading-relaxed">
          Read-only. To reply: open ⌘K, ask KAI to draft — it queues for your approval.
        </p>
      </div>
    </Panel>
  );
}

function stripName(from: string): string {
  /* "Alice <a@x.com>" → "Alice"; "<a@x.com>" → "a@x.com" */
  const m = from.match(/^\s*"?([^"<]+)"?\s*<([^>]+)>\s*$/);
  if (m) return (m[1] || m[2]).trim();
  return from;
}

function relDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(+d)) return '';
    const diff = Date.now() - +d;
    if (diff < 60 * 60_000)       return Math.max(1, Math.round(diff / 60_000)) + 'm';
    if (diff < 24 * 60 * 60_000)  return Math.round(diff / (60 * 60_000)) + 'h';
    if (diff < 7 * 86_400_000)    return Math.round(diff / 86_400_000) + 'd';
    return d.toLocaleDateString(operator.locale, { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

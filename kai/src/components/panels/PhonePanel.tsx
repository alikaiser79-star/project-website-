/* ============================================================
   PhonePanel — read-only Twilio Messages digest. SMS + WhatsApp
   threads, inbound + outbound, last 7 days. Outbound flows go
   through ⌘K → propose_sms → ConfirmationGate.
   ============================================================ */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, RefreshCw, Loader2, AlertTriangle, MessageSquare, MessageCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Panel from '../Panel';
import { sfx } from '../../lib/sound';

interface Msg {
  sid: string;
  channel: 'sms' | 'whatsapp';
  direction: string;
  from_masked: string;
  to_masked: string;
  body: string;
  status: string;
  date_sent: string | null;
  error_code: string | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'no_creds'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; messages: Msg[] };

export default function PhonePanel({ delay = 0 }: { delay?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  async function load() {
    setState({ kind: 'loading' });
    try {
      const r = await fetch('/api/phone/list?days=7');
      const data = await r.json().catch(() => ({}));
      if (r.status === 503) {
        setState({ kind: 'no_creds', message: String(data?.message || 'Twilio not connected') });
        return;
      }
      if (!r.ok) {
        setState({ kind: 'error', message: String(data?.message || `http ${r.status}`) });
        return;
      }
      setState({ kind: 'ok', messages: Array.isArray(data?.messages) ? data.messages : [] });
    } catch (e: any) {
      setState({ kind: 'error', message: String(e?.message || 'fetch failed') });
    }
  }
  useEffect(() => { load(); }, []);

  const tag =
    state.kind === 'loading'  ? 'loading…' :
    state.kind === 'no_creds' ? 'not connected' :
    state.kind === 'error'    ? 'error' :
    state.kind === 'ok'       ? `${state.messages.length} msg · 7d` : '';

  return (
    <Panel num="16" title="Phone" tag={tag} delay={delay}>
      <div className="space-y-3">
        {state.kind === 'ok' && (
          <div className="flex items-center gap-2">
            <Phone size={11} className="text-amber/75" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/80">sms · whatsapp</span>
            <button onClick={() => { sfx.click(); load(); }} className="ml-auto p-1 text-steel hover:text-amber transition" title="Refresh">
              <RefreshCw size={11} />
            </button>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-8 font-mono text-[11px] text-steel">
            <Loader2 size={14} className="animate-spin text-amber mr-2" /> reading messages…
          </div>
        )}

        {state.kind === 'no_creds' && (
          <div className="px-3 py-3 border border-amber/20 rounded bg-amber/[0.04] text-bone/85 text-[11.5px] leading-relaxed">
            <strong className="text-amber font-medium">Twilio isn't connected yet.</strong>
            <p className="mt-1 text-steel">{state.message}</p>
            <ul className="mt-2 list-disc list-inside text-steel/85 space-y-0.5 font-mono text-[10.5px]">
              <li>TWILIO_ACCOUNT_SID</li>
              <li>TWILIO_AUTH_TOKEN</li>
              <li>TWILIO_FROM_NUMBER (E.164, e.g. +15551234567)</li>
              <li>TWILIO_WHATSAPP_FROM (optional)</li>
              <li>KAI_PHONE_CONTACTS (optional, JSON: [&#123;name, phone&#125;])</li>
            </ul>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="px-3 py-2 border border-danger/30 rounded bg-danger/[0.05] text-danger text-[11.5px] flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <div className="flex-1">{state.message}</div>
            <button onClick={load} className="text-amber hover:underline shrink-0">retry</button>
          </div>
        )}

        {state.kind === 'ok' && state.messages.length === 0 && (
          <div className="px-3 py-4 border border-amber/15 rounded text-center">
            <MessageSquare size={18} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12px]">No messages in the last 7 days.</p>
          </div>
        )}

        {state.kind === 'ok' && state.messages.length > 0 && (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {state.messages.map(m => <MsgRow key={m.sid} m={m} />)}
            </AnimatePresence>
          </ul>
        )}

        <p className="font-mono text-[9.5px] text-steel/60 leading-relaxed">
          Read-only. Replies &amp; outbound go through ⌘K → ConfirmationGate.
        </p>
      </div>
    </Panel>
  );
}

function MsgRow({ m }: { m: Msg }) {
  const inbound = /inbound/i.test(m.direction);
  const failed = m.status === 'failed' || m.status === 'undelivered' || !!m.error_code;
  const ChannelIcon = m.channel === 'whatsapp' ? MessageCircle : MessageSquare;
  const peer = inbound ? m.from_masked : m.to_masked;
  return (
    <motion.li
      initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={'px-2.5 py-1.5 border rounded transition ' + (failed ? 'border-danger/30 hover:border-danger/50' : 'border-amber/10 hover:border-amber/30')}
    >
      <div className="flex items-baseline gap-2">
        {inbound
          ? <ArrowDownLeft size={10} className="text-cyan/80 shrink-0" />
          : <ArrowUpRight   size={10} className="text-amber/80 shrink-0" />}
        <ChannelIcon size={10} className={m.channel === 'whatsapp' ? 'text-emerald/85 shrink-0' : 'text-steel/80 shrink-0'} />
        <span className="font-mono text-[10.5px] tabular-nums text-bone/85 shrink-0">{peer}</span>
        <span className="ml-auto font-mono text-[9.5px] text-steel/70 shrink-0">{rel(m.date_sent)}</span>
      </div>
      {m.body && (
        <div className="font-sans text-[11.5px] text-bone/85 leading-snug mt-0.5 line-clamp-2">
          {m.body}
        </div>
      )}
      {failed && (
        <div className="font-mono text-[9.5px] text-danger/85 mt-0.5">
          {m.status}{m.error_code ? ' · ' + m.error_code : ''}
        </div>
      )}
    </motion.li>
  );
}

function rel(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(+d)) return '';
    const diff = Date.now() - +d;
    if (diff < 60 * 60_000)      return Math.max(1, Math.round(diff / 60_000)) + 'm';
    if (diff < 24 * 60 * 60_000) return Math.round(diff / (60 * 60_000)) + 'h';
    if (diff < 7 * 86_400_000)   return Math.round(diff / 86_400_000) + 'd';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

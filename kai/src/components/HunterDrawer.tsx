/* ============================================================
   DER JÄGER (§Q3.4) — the Hunter, made visible. A ranked opportunity
   ledger: every line is a real revenue move with EGP attached, sorted
   by expected EGP per minute of Ali's time. Expand → the draft writes
   itself → one tap approves (through the Gate) or dismisses (KAI learns).
   Top: the proof-of-worth ledger. KAI proposes; Kaiser disposes.
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  runHunt, hunterLedger, draftOpportunity, approveOpportunity, dismissOpportunity,
  type Opportunity, type Draft, type HunterLedger,
} from '../lib/kai/hunter';
import { assembleContext, annotatedMoves } from '../lib/kai/council';
import { emit } from '../lib/kai/store';
import { toast } from '../hooks/useToasts';
import { Crosshair, Check, X, Copy, ChevronDown } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; }
const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

export default function HunterDrawer({ open, onClose }: Props) {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [ledger, setLedger] = useState<HunterLedger | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft | 'loading'>>({});

  useEffect(() => {
    if (!open) return;
    /* §25 — moves arrive filtered THROUGH the Twin, so a lane his own record
       says he abandons carries that warning on the card. */
    try {
      runHunt();                                         // persist the hunt to the Spine
      setOpps(annotatedMoves(assembleContext(Date.now(), true)));
      setLedger(hunterLedger());
    } catch { setOpps([]); }
    setOpenId(null); setDrafts({});
  }, [open]);

  async function expand(o: Opportunity) {
    if (openId === o.id) { setOpenId(null); return; }
    setOpenId(o.id);
    if (o.kind === 'pricing') return;                 // no message to draft
    if (drafts[o.id]) return;
    setDrafts((d) => ({ ...d, [o.id]: 'loading' }));
    try { const dr = await draftOpportunity(o); setDrafts((d) => ({ ...d, [o.id]: dr })); }
    catch { setDrafts((d) => ({ ...d, [o.id]: { channel: 'email', body: '(draft failed)' } })); }
  }

  function approve(o: Opportunity) {
    const draft = o.kind === 'pricing' ? { channel: 'rate' as const, body: '' } : (drafts[o.id] as Draft);
    if (o.kind !== 'pricing' && (!draft || draft === ('loading' as any))) { toast.warn('Let the draft finish first.', 'HUNTER'); return; }
    const res = approveOpportunity(o, draft);
    emit();
    if (res.ok) toast.ok(res.note, 'HUNTER', 3600); else toast.err(res.note, 'HUNTER');
    setOpps((list) => list.filter((x) => x.id !== o.id));
    setLedger(hunterLedger());
  }

  function dismiss(o: Opportunity) {
    dismissOpportunity(o);
    setOpps((list) => list.filter((x) => x.id !== o.id));
    toast.ok('Dismissed — KAI will stop proposing that shape.', 'HUNTER', 2800);
  }

  function copyDraft(o: Opportunity) {
    const d = drafts[o.id];
    if (d && d !== 'loading') { try { navigator.clipboard?.writeText(d.body); toast.ok('Draft copied.', 'HUNTER', 2000); } catch { /* ignore */ } }
  }

  if (!open) return null;

  return (
    <div className="hunter-scrim" data-noswipe onClick={onClose}>
      <div className="hunter" role="dialog" aria-label="Der Jäger" data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="hunter-head">
          <span className="hunter-title"><Crosshair size={12} /> DER JÄGER · THE HUNT</span>
          <button className="hunter-x" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="hunter-body">
          {ledger && <div className="hunter-ledger">{ledger.line}</div>}

          {opps.length === 0 && <div className="hunter-empty">No moves worth your time right now. KAI keeps watching.</div>}

          {opps.map((o) => {
            const expanded = openId === o.id;
            const d = drafts[o.id];
            return (
              <div key={o.id} className={'hunter-opp k-' + o.kind}>
                <button className="hunter-opp-head" onClick={() => expand(o)}>
                  <div className="hunter-opp-main">
                    <div className="hunter-opp-title">{o.title}</div>
                    <div className="hunter-opp-money">
                      <b>+{egp(o.expectedEgp)} EGP</b>
                      <span>· {egp(o.egpPerMin)}/min · {o.minutes}m you</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className={'hunter-chev' + (expanded ? ' up' : '')} />
                </button>

                {expanded && (
                  <div className="hunter-opp-detail">
                    <div className="hunter-rationale">{o.rationale}</div>
                    {(o as any).twinNote && <div className="hunter-twin-note">{(o as any).twinNote}</div>}
                    {o.kind !== 'pricing' && (
                      <div className="hunter-draft">
                        {d === 'loading' || !d ? <span className="hunter-drafting">drafting…</span> : (
                          <>
                            {d.subject && <div className="hunter-subj">{d.subject}</div>}
                            <div className="hunter-msg">{d.body}</div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="hunter-actions">
                      <button className="hunter-approve" onClick={() => approve(o)}>
                        <Check size={13} /> {o.kind === 'pricing' ? 'Apply raise' : o.kind === 'broadcast' ? 'Approve · send' : 'Approve → Gate'}
                      </button>
                      {o.kind === 'broadcast' && <button className="hunter-copy" onClick={() => copyDraft(o)}><Copy size={12} /> copy</button>}
                      <button className="hunter-dismiss" onClick={() => dismiss(o)}><X size={13} /> dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   WAR CHEST session (§9.3/9.4) — freed money gets marching orders.
   Heads with the DETERMINISTIC freed-cashflow figure (real math or the
   session never opened), then the Council: 3-5 deployment OPTIONS,
   never orders, each in a fixed card shape. Doctrine #1 (kill debt
   first) leads while any debt remains. Market-based ideas are a
   CATEGORY with a MARKET EYE research button — KAI never invents
   prices. Picking an option commits it as a real Mirror commitment.
   Footer disclaimer is permanent: KAI is not a licensed advisor.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Coins, X, Radar, Check, ShieldAlert } from 'lucide-react';
import {
  latestMilestone, requestCouncil, commitDeployment, acknowledgeMilestone, warChestDisclaimer,
  type DeployOption, type Milestone,
} from '../lib/kai/warchest';
import { launchMission } from '../lib/kai/agent';
import { toast } from '../hooks/useToasts';

const RISK_COLOR: Record<string, string> = { LOW: '#7AE6A8', MED: '#FFB300', HIGH: '#E0503A' };

export default function WarChestSession({ onClose }: { onClose: () => void }) {
  const [m] = useState<Milestone | null>(() => latestMilestone());
  const [options, setOptions] = useState<DeployOption[] | null>(null);
  const [committing, setCommitting] = useState<string | null>(null);

  useEffect(() => {
    if (!m) return;
    let alive = true;
    requestCouncil(m).then((r) => { if (alive) setOptions(r.options); }).catch(() => alive && setOptions([]));
    return () => { alive = false; };
  }, [m]);

  if (!m) return null;

  function dismiss() { acknowledgeMilestone(m!.id); onClose(); }

  async function commit(opt: DeployOption) {
    setCommitting(opt.name);
    try {
      await commitDeployment(opt, m!);
      toast.ok(`Committed: ${opt.name}. It's a Mirror commitment now.`, 'WAR CHEST', 4000);
      onClose();
    } finally { setCommitting(null); }
  }

  function marketEye(opt: DeployOption) {
    const goal = 'Fetch CURRENT, sourced data for this deployment idea — real EGP figures, yields and risks, every number with its source URL.\n\nIDEA: ' + (opt.marketQuery || opt.name);
    launchMission(goal, 'market_eye');
    toast.ok('MARKET EYE dispatched — sourced research incoming.', 'WAR CHEST', 3500);
  }

  return (
    <div className="wc-scrim" data-noswipe onClick={dismiss}>
      <div className="wc-sheet" role="dialog" aria-label="War Chest" data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="wc-head">
          <span className="flex items-center gap-2"><Coins size={16} className="wc-gold" /><span className="wc-title">WAR CHEST</span></span>
          <button className="share-x" onClick={dismiss} aria-label="close"><X size={14} /></button>
        </div>

        <div className="wc-freed">
          <div className="wc-freed-label">{m.label}</div>
          <div className="wc-freed-num">FREED: {m.freedEgp.toLocaleString()} <span>EGP/month</span></div>
          <div className="wc-freed-math">{m.detail}</div>
        </div>

        {options === null ? (
          <div className="wc-loading">KAI is drawing up options…</div>
        ) : options.length === 0 ? (
          <div className="wc-loading">Could not reach the council. Try again shortly.</div>
        ) : (
          <div className="wc-options">
            {options.map((opt, i) => (
              <div key={i} className={'wc-card' + (opt.kind === 'debt' ? ' is-debt' : '')}>
                <div className="wc-card-head">
                  <span className="wc-card-name">{i + 1}. {opt.name}</span>
                  <span className="wc-risk" style={{ color: RISK_COLOR[opt.risk] }}>{opt.risk}</span>
                </div>
                {opt.what.map((w, j) => <div key={j} className="wc-what">{w}</div>)}
                <div className="wc-meta">
                  <div><span>MATH</span>{opt.math}</div>
                  <div><span>RISK</span>{opt.riskLine}</div>
                  <div className="wc-meta-row3">
                    <span className="wc-chip">⏱ {opt.effort}</span>
                    <span className="wc-chip">💰 {opt.ttfc}</span>
                  </div>
                  <div><span>FIRST MOVE</span>{opt.firstMove}</div>
                </div>
                {opt.market ? (
                  <button className="wc-market" onClick={() => marketEye(opt)}><Radar size={13} /> MARKET EYE — get sourced data</button>
                ) : (
                  <button className="wc-commit" disabled={committing === opt.name} onClick={() => commit(opt)}>
                    {committing === opt.name ? 'Committing…' : <><Check size={13} /> Commit this</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="wc-disclaimer"><ShieldAlert size={12} /> {warChestDisclaimer()}</div>
      </div>
    </div>
  );
}

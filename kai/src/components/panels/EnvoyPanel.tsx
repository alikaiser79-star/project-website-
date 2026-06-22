/* ============================================================
   EnvoyPanel — three German registers. Tap to set the active
   one; ⌘K + propose_* tools then default to that voice.
   ============================================================ */

import { Languages, Check } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import { REGISTERS, getActiveRegister, setActiveRegister, type RegisterKey } from '../../lib/kai/envoy';
import { sfx } from '../../lib/sound';

const COLOR: Record<RegisterKey, string> = {
  enpal_formal:   '#5FE3FF',
  sales_outreach: '#FFB300',
  guest_friendly: '#7AE6A8',
};

export default function EnvoyPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const active = getActiveRegister();
  const activeReg = REGISTERS.find(r => r.key === active);
  const tag = activeReg ? activeReg.label : 'no register';

  function set(k: RegisterKey | null) {
    sfx.click();
    setActiveRegister(k);
  }

  return (
    <Panel num="20" title="The Envoy" tag={tag} delay={delay}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
          <Languages size={11} className="text-amber/75" />
          <span>de · three registers</span>
          {active && (
            <button
              onClick={() => set(null)}
              className="ml-auto text-steel/65 hover:text-bone/85 tracking-[0.16em] uppercase text-[9.5px]"
            >
              clear
            </button>
          )}
        </div>

        <ul className="space-y-2">
          {REGISTERS.map(r => {
            const isActive = r.key === active;
            return (
              <li
                key={r.key}
                onClick={() => set(isActive ? null : r.key)}
                className={
                  'cursor-pointer px-3 py-2.5 border rounded transition ' +
                  (isActive
                    ? 'border-amber bg-amber/10 shadow-glow-amber'
                    : 'border-amber/15 hover:border-amber/40')
                }
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: COLOR[r.key], boxShadow: `0 0 6px ${COLOR[r.key]}` }}
                  />
                  <span className="font-sans text-bone text-[12.5px] truncate flex-1 min-w-0">{r.label}</span>
                  {isActive && <Check size={11} className="text-amber shrink-0" />}
                </div>
                <div className="font-mono text-[10px] text-steel/85 leading-relaxed mt-0.5">{r.lane}</div>
                <div className="font-sans text-[11px] text-bone/70 leading-snug mt-1.5 italic">
                  "{r.examples[0]?.split('\n')[1]?.slice(0, 80) || r.examples[0]?.slice(0, 80) || ''}…"
                </div>
              </li>
            );
          })}
        </ul>

        <p className="font-mono text-[9.5px] text-steel/60 leading-relaxed">
          When set, propose_email / propose_sms default to this voice. Override per-draft via the tool's <span className="text-amber/80">register</span> param.
        </p>
      </div>
    </Panel>
  );
}

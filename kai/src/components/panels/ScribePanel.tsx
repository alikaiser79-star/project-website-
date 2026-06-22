/* ============================================================
   ScribePanel — patterns over the Spine. How Ali actually wins.
   ============================================================ */

import { motion } from 'framer-motion';
import { BookOpen, TrendingUp, Minus, AlertCircle } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import { listInsights } from '../../lib/kai/scribe';

export default function ScribePanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const insights = listInsights();
  const tag = insights.length === 0 ? 'gathering data' : `${insights.length} pattern${insights.length === 1 ? '' : 's'}`;

  return (
    <Panel num="19" title="The Scribe" tag={tag} delay={delay}>
      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="px-3 py-5 border border-amber/15 rounded text-center">
            <BookOpen size={20} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12.5px]">No patterns yet.</p>
            <p className="text-steel text-[10.5px] mt-1 max-w-[320px] mx-auto leading-relaxed">
              The Scribe reads the Spine. Log some real data — payments, posts,
              autopilot runs — and patterns about how you actually operate
              appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {insights.map((i, idx) => (
              <motion.li
                key={i.key}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="px-3 py-2 border border-amber/15 rounded bg-ink2/30"
              >
                <div className="flex items-baseline gap-2">
                  {i.tone === 'good'
                    ? <TrendingUp size={11} className="text-emerald shrink-0" />
                    : i.tone === 'warn'
                      ? <AlertCircle size={11} className="text-danger/90 shrink-0" />
                      : <Minus size={11} className="text-steel/85 shrink-0" />}
                  <span className="font-sans text-bone text-[12.5px] truncate flex-1 min-w-0">{i.title}</span>
                  {i.value !== undefined && i.value !== null && (
                    <span className={
                      'font-mono text-[12px] tabular-nums shrink-0 ' +
                      (i.tone === 'good' ? 'text-emerald' :
                       i.tone === 'warn' ? 'text-danger/90' :
                       'text-bone/90')
                    }>
                      {i.value}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10.5px] text-steel/85 leading-relaxed mt-0.5">{i.detail}</div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

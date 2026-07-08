/* ============================================================
   SHARE CAPTURE (§8.3) — where a shared URL/text lands. KAI is a
   registered OS share target (GET share_target → '/'); App parses the
   shared params on launch and opens this sheet. Three destinations:
     · Brain Dump it        — drop it into the inbox to triage later
     · Make it a deadline    — a dated commitment in the Calendar of War
     · Launch a MARKET EYE   — hand it to the mission agent to research
   Every capture is logged to the Spine (system.share_captured).
   ============================================================ */

import { useState } from 'react';
import { Inbox, CalendarClock, Radar } from 'lucide-react';
import { addDeadline } from '../lib/kai/deadlines';
import { launchMission } from '../lib/kai/agent';
import { logEvent } from '../lib/kai/events';
import { toast } from '../hooks/useToasts';

export interface ShareContent { url?: string; text?: string; title?: string; }

interface Props {
  content: ShareContent;
  onBrainDump: (text: string) => void;
  onLaunched: () => void;     // navigate to the agent view after a mission
  onClose: () => void;
}

const DAY = 86_400_000;

export default function ShareCaptureSheet({ content, onBrainDump, onLaunched, onClose }: Props) {
  const [days, setDays] = useState(7);
  const combined = [content.title, content.text, content.url].filter(Boolean).join('\n').trim();
  const headline = (content.title || content.text || content.url || 'Shared item').slice(0, 120);

  function log(kind: string) {
    try { logEvent({ domain: 'system', type: 'share_captured', value: 1, meta: { kind, url: content.url || undefined }, source: 'auto' }); } catch { /* ignore */ }
  }

  function brainDump() {
    log('braindump');
    onBrainDump(combined || headline);
    onClose();
  }

  function makeDeadline() {
    const when = Date.now() + days * DAY;
    addDeadline(headline, when);
    log('deadline');
    toast.ok(`Deadline set · ${new Date(when).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`, 'SHARE', 3500);
    onClose();
  }

  function launch() {
    const target = content.url || content.text || headline;
    const goal =
      'Search current data relevant to this, and return a sourced brief with real ' +
      'numbers and links — every figure carries its source URL.\n\nSTART FROM: ' + target;
    launchMission(goal, 'market_eye');
    log('mission');
    toast.ok('MARKET EYE mission launched.', 'SHARE', 3500);
    onClose();
    onLaunched();
  }

  return (
    <div className="share-scrim" data-noswipe onClick={onClose}>
      <div className="share-sheet" role="dialog" aria-label="Capture shared item" data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          <span className="share-title">CAPTURE</span>
          <button className="share-x" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="share-preview" title={combined}>
          {content.url && <div className="share-url">{content.url}</div>}
          {(content.title || content.text) && <div className="share-text">{content.title || content.text}</div>}
          {!content.url && !content.title && !content.text && <div className="share-text">Nothing was shared.</div>}
        </div>

        <div className="share-actions">
          <button className="share-act" onClick={brainDump}>
            <Inbox size={15} /><span>Brain Dump it</span>
            <em>triage later in the inbox</em>
          </button>

          <button className="share-act" onClick={makeDeadline}>
            <CalendarClock size={15} /><span>Make it a deadline</span>
            <em>a dated line in the Calendar of War</em>
            <select
              className="share-days"
              value={days}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            >
              <option value={3}>in 3 days</option>
              <option value={7}>in 7 days</option>
              <option value={14}>in 14 days</option>
              <option value={30}>in 30 days</option>
            </select>
          </button>

          <button className="share-act" onClick={launch}>
            <Radar size={15} /><span>Launch MARKET EYE</span>
            <em>the agent researches it, sourced</em>
          </button>
        </div>
      </div>
    </div>
  );
}

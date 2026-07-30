/* §47 DER BRIEF — the black screen, once a year.

   Deliberately the least designed surface in the project. No tiles, no
   chrome, no counters, no encouragement, no word target. Black, the
   four questions, and a box. Anything else I put here becomes the shape
   of what he writes, and then it is partly my letter.

   The two-step send is not a UI nicety: the seal cannot be undone, and
   a mistyped command has already been shown to be one keystroke from
   consuming his one letter for the year. He reads it back, then sends. */
import { useState } from 'react';
import { dayState, setDraft, sendDraft, discardDraft, draft, survival } from '../lib/kai/brief';
import { useKaiVersion } from '../lib/kai/mirror';

const BLACK = '#000';
const INK = '#e8e4dc';
const DIM = '#6f6a63';

export default function DerBrief({ onClose }: { onClose?: () => void }) {
  useKaiVersion();
  const d = dayState();
  const [text, setText] = useState(draft());
  const [held, setHeld] = useState(!!draft());
  const [done, setDone] = useState<string | null>(null);

  function hold() {
    const r = setDraft(text);
    if (!r.ok) { setDone(r.reason); return; }
    setHeld(true);
  }

  function send() {
    const r = sendDraft();
    setDone(r.reason);
    if (r.ok) setHeld(false);
  }

  const wrap: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999, background: BLACK, color: INK,
    overflowY: 'auto', padding: '8vh 6vw 12vh', WebkitFontSmoothing: 'antialiased',
  };
  const col: React.CSSProperties = { maxWidth: 640, margin: '0 auto' };

  if (done) {
    return (
      <div style={wrap}>
        <div style={col}>
          <p style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{done}</p>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: DIM, marginTop: 28 }}>{survival().line}</p>
          <button onClick={onClose} style={{ marginTop: 36, background: 'none', border: `1px solid ${DIM}`, color: INK, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={col}>
        {d.done ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.7 }}>
              {new Date().getUTCFullYear()} is written and sealed. It does not reopen.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: DIM, marginTop: 24 }}>{survival().line}</p>
          </>
        ) : (
          <>
            {/* The prompt, unstyled and unstructured on purpose. */}
            <p style={{ fontSize: 17, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{d.prompt}</p>

            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); if (held) setHeld(false); }}
              rows={10}
              autoFocus
              spellCheck={false}
              style={{
                width: '100%', marginTop: 32, background: 'transparent', color: INK,
                border: 'none', borderTop: `1px solid #211f1c`, outline: 'none', resize: 'vertical',
                fontSize: 16, lineHeight: 1.8, fontFamily: 'inherit', padding: '20px 0',
              }}
            />

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {!held ? (
                <button onClick={hold} disabled={!text.trim()}
                  style={{ background: 'none', border: `1px solid ${DIM}`, color: text.trim() ? INK : DIM, padding: '10px 20px', fontSize: 13, cursor: text.trim() ? 'pointer' : 'default' }}>
                  Read it back
                </button>
              ) : (
                <>
                  <button onClick={send}
                    style={{ background: INK, border: `1px solid ${INK}`, color: BLACK, padding: '10px 22px', fontSize: 13, cursor: 'pointer' }}>
                    Send it
                  </button>
                  <button onClick={() => { discardDraft(); setText(''); setHeld(false); }}
                    style={{ background: 'none', border: `1px solid ${DIM}`, color: DIM, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
                    Discard
                  </button>
                </>
              )}
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', color: DIM, fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>
                Not tonight
              </button>
            </div>

            {held && (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: DIM, marginTop: 24 }}>
                Sending seals it for ten years, with my record of the year alongside it. It cannot be edited afterwards.
                Nothing is written until you press send.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

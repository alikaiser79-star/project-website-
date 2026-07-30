/* ============================================================
   INVITATIONS — the things that used to take the screen.

   The War Chest and the Day Ritual both opened themselves on boot, full
   screen, over live data. In testing they intercepted every click on
   the dashboard, which is how a stacking-context bug in the section
   tiles stayed hidden — the modal was eating the taps.

   Worse, the War Chest re-armed on EVERY Spine write (debounced 800ms),
   so logging anything could throw it back up while a milestone stayed
   pending. That is not a notification, it is a door that keeps opening.

   ── WHY THIS IS NOT A DELETION ────────────────────────────────
   Neither had any other way in. `warChestOpen` was set in exactly one
   place — the auto-open effect — and DayRitual in exactly two. Removing
   the auto-open alone would have made both permanently unreachable, so
   the capability moves here rather than disappearing: a single line of
   chips that says what is waiting and opens it when tapped.

   The rule it encodes: KAI may say something is waiting. It may not
   decide it has your attention. */
import { shouldDayCompile, shouldShutdown } from '../lib/kai/protocol';
import { hasVictory } from '../lib/kai/warchest';
import { useKaiVersion } from '../lib/kai/mirror';

export default function Invitations({
  onWarChest, onRitual, lockOff, onProtect,
}: {
  onWarChest: () => void;
  onRitual: (mode: 'compile' | 'shutdown') => void;
  /* The lock is off. Shown for as long as that is true, rather than
     once ever — the old one-shot prompt set `offered` the moment it
     was dismissed and never came back. */
  lockOff: boolean;
  onProtect: () => void;
}) {
  useKaiVersion();

  const victory = (() => { try { return hasVictory(); } catch { return false; } })();
  const shutdown = (() => { try { return shouldShutdown(); } catch { return false; } })();
  const compile  = (() => { try { return !shutdown && shouldDayCompile(); } catch { return false; } })();

  if (!victory && !shutdown && !compile && !lockOff) return null;

  const chip =
    'px-3 py-1.5 rounded-full border border-amber/35 hover:border-amber text-amber ' +
    'font-mono text-[11px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors';

  return (
    <div className="flex items-center gap-2 flex-wrap" data-invitations>
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel">waiting</span>
      {victory && <button className={chip} onClick={onWarChest}>War chest</button>}
      {shutdown && <button className={chip} onClick={() => onRitual('shutdown')}>Shut down the day</button>}
      {compile && <button className={chip} onClick={() => onRitual('compile')}>Compile the day</button>}
      {lockOff && <button className={chip} onClick={onProtect}>Protect KAI</button>}
    </div>
  );
}

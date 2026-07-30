import { AnimatePresence, motion } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

const rows: Array<[string[], string]> = [
  [['1'],       'Command view'],
  [['2'],       'Money view'],
  [['3'],       'Growth view'],
  [['4'],       'Operations view'],
  [['5'],       'Comms view'],
  [['←', '→'],  'Walk views (swipe on touch)'],
  [['Swipe'],   'Walk views (horizontal)'],
  [['A'],       'Ask KAI'],
  [['O'],       'One Thing focus'],
  [['⌘', 'K'],  'Open command bar'],
  [['⌘', '/'],  'Spotlight search'],
  [['Esc'],     'Close any overlay'],
  [['V'],       'Toggle voice recognition'],
  [['M'],       'Toggle UI sound'],
  [['S'],       'Open settings'],
  [['J'],       'Quick capture (journal)'],
  [['⌘', 'J'],  'Quick capture (anywhere)'],
  [['?'],       'This cheatsheet'],
  [['↑','↓'],   'Navigate command bar'],
  [['↵'],       'Send / confirm'],
];

/* THE COMMAND CATALOGUE.

   Thirteen sections shipped reachable only by typing an exact word
   that appeared nowhere in the interface, and this file — the one
   place a user goes to find out what exists — listed none of them.
   Capability you cannot find is capability you do not have.

   Grouped by what he is actually trying to do, not by section number,
   because "§44.3" is meaningless at the moment you want to know where
   the next pound goes. */
const commands: Array<[string, Array<[string, string]>]> = [
  ['The day', [
    ['today', 'One ruling — the single thing that moves the needle'],
    ['tag 400 cleaner', 'Ten-second logger — amount and word'],
    ['brief', 'The daily briefing'],
  ]],
  ['Money and assets', [
    ['markt', 'The whole board — every asset ranked by return'],
    ['haus', 'What each asset says about itself'],
    ['garden', 'The garden — events, produce, water, profit'],
    ['comps', 'Rate comps, filtered to your own unit class'],
    ['runway', 'Days of freedom at the current burn'],
  ]],
  ['People and promises', [
    ['welt', 'Who owes what, and who is owed'],
    ['reckon', 'The weekly reckoning'],
    ['close Katie Mum', 'Name the people who matter; then "close" reads it back'],
  ]],
  ['You', [
    ['mann', 'Body, medication dates, hours, the people column'],
    ['hours', 'Where the month actually went'],
    ['honestly <one line>', 'The weekly question — recorded, never judged'],
    ['meds', 'Medication dates and counts you entered'],
  ]],
  ['The long record', [
    ['letters', 'The sealed letters and whether they will survive'],
    ['vault', 'What future you needs — locations, never files'],
    ['handover', 'The canonical brief every next model reads first'],
    ['handover <advice>', 'Check advice against what you were already told'],
    ['buch', 'The month as a chapter'],
  ]],
  ['Is this worth it', [
    ['preis', 'What KAI cost you and what you say it earned'],
    ['ende', 'The build freeze, and what opens it'],
    ['capture <idea>', 'Hold an idea without building it'],
    ['orden', 'Whether the method works on someone who is not you'],
  ]],
];

export default function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] grid place-items-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ y: -8, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="glass w-[min(620px,94vw)] max-h-[86vh] overflow-y-auto rounded-md"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2 text-amber/90">
                <Keyboard size={14} />
                <h3 className="font-sans text-bone text-sm tracking-wide">What KAI can do</h3>
              </div>
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px]">
              {rows.map(([keys, label]) => (
                <div key={label} className="flex items-center gap-2 py-1">
                  <span className="flex gap-1">{keys.map(k => <kbd key={k}>{k}</kbd>)}</span>
                  <span className="text-bone">{label}</span>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3">
              {commands.map(([group, items]) => (
                <div key={group} className="mt-4">
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-amber/70 mb-1.5">{group}</div>
                  {items.map(([cmd, what]) => (
                    <div key={cmd} className="flex items-baseline gap-3 py-[3px]">
                      <code className="font-mono text-[12px] text-amber whitespace-nowrap">{cmd}</code>
                      <span className="text-[12px] text-steel leading-snug">{what}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <footer className="px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel sticky bottom-0 bg-[#0a0e14]">
              press <kbd>⌘</kbd><kbd>K</kbd> and type any of these
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

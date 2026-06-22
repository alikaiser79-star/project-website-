/* ============================================================
   The Envoy — three voice registers KAI can write in.

     enpal_formal   — Sie, precise, Fachabteilung-clean. For
                       internal Enpal correspondence: VBA flows,
                       Protokoll notes, SE-format escalations.
                       Direct without being curt. No filler.
     sales_outreach — Sharp German sales tone. Crisp opener,
                       clear value, one ask. No "Sehr geehrte"
                       walls unless the lead warrants it. Du for
                       younger founders, Sie for corporate.
     guest_friendly — Warm hospitality German for Makadi guests.
                       Welcoming, practical, helpful. Du-by-
                       default, easy to read for non-natives.

   The Envoy is a thin contract: a register key + a system-
   prompt fragment Claude prepends when drafting. The actual
   draft happens via the existing propose_email / propose_sms
   tools, which already accept a `register` hint — Envoy
   formalises the catalog.

   When Ali plugs in his real Enpal library (VBA, Protokoll,
   SE-format templates), drop them into the body of the
   matching register entry. The Envoy reads from this single
   source.
   ============================================================ */

import { read, write, emit } from './store';

export type RegisterKey = 'enpal_formal' | 'sales_outreach' | 'guest_friendly';

export interface Register {
  key: RegisterKey;
  label: string;
  lane: string;
  systemFragment: string;
  examples: string[];
}

export const REGISTERS: Register[] = [
  {
    key: 'enpal_formal',
    label: 'Enpal · formal',
    lane: 'Internal Enpal correspondence — Fachabteilung, Protokoll, SE-format escalations.',
    systemFragment:
      'WRITE IN GERMAN. Register: enpal_formal — Sie throughout. ' +
      'Precise, Fachabteilung-clean. No filler, no "Sehr geehrte Damen und Herren" ' +
      'walls unless required. Direct without being curt. Cite Protokoll / ticket ' +
      'numbers when relevant. SE-format escalation pattern when escalating. ' +
      'Keep paragraphs short; one ask per email.',
    examples: [
      'Sehr geehrte Herr Müller,\nbezüglich des Protokolls vom 14.03 …',
      'Hallo Sandra,\nkurze Rückmeldung zum SE-2841 …',
    ],
  },
  {
    key: 'sales_outreach',
    label: 'Sales · sharp',
    lane: 'Cold + warm German outreach to D2C and partner leads.',
    systemFragment:
      'WRITE IN GERMAN. Register: sales_outreach — sharp, crisp. ' +
      'Open with the prospect\'s specific situation, not your bio. One sentence ' +
      'on value. One ask. Du for founders / startups, Sie for corporate roles. ' +
      'Max 4 short paragraphs. No emojis. Signature: short.',
    examples: [
      'Hi Lukas,\nIhr 8-Personen-Team in Stuttgart skaliert gerade die DACH-Pipeline …',
      'Hallo Herr Weber,\nGesehen, dass Sie die neue B2B-Sparte aufbauen …',
    ],
  },
  {
    key: 'guest_friendly',
    label: 'Guest · warm',
    lane: 'Makadi Airbnb guests — booking, check-in, on-site help.',
    systemFragment:
      'WRITE IN GERMAN. Register: guest_friendly — warm, practical, helpful. ' +
      'Du-by-default. Short, easy for non-native speakers. Welcoming opener, ' +
      'concrete answer, one offer to help further. Mention Makadi, the apartment, ' +
      'or the area when natural. No corporate stiffness.',
    examples: [
      'Hallo Anna,\nschön, dass du nach Makadi kommst …',
      'Hi Markus,\nkurz zum Check-in am Freitag …',
    ],
  },
];

export function getRegister(key: RegisterKey): Register | undefined {
  return REGISTERS.find(r => r.key === key);
}

export function systemFragmentFor(key: RegisterKey | undefined | null): string {
  if (!key) return '';
  return getRegister(key)?.systemFragment || '';
}

/* Active register — what KAI defaults to when no register is
   specified on a propose_* call. Persisted so a "switch to
   guest mode" sets a sticky stance for the session. */
const ACTIVE_KEY = 'kai.envoy.active';

export function getActiveRegister(): RegisterKey | null {
  return read<RegisterKey | null>(ACTIVE_KEY, null);
}

export function setActiveRegister(key: RegisterKey | null): void {
  write(ACTIVE_KEY, key);
  emit();
}

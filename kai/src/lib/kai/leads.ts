/* ============================================================
   LEADS — the agency pipeline (Spine domain 'leads'). The agent may
   move a card to DRAFTED at most; SENT happens only when Ali approves
   the Gmail-draft proposal at the Gate (the agent never sends mail).
   Counts feed an organ signal so the heart knows the pipeline needs
   attention. Client-side store; every change logs a leads event.
   ============================================================ */

import { logEvent } from './events';

export type LeadStage = 'FOUND' | 'RESEARCHED' | 'DRAFTED' | 'SENT' | 'REPLIED' | 'WON' | 'DEAD';
export const LEAD_STAGES: LeadStage[] = ['FOUND', 'RESEARCHED', 'DRAFTED', 'SENT', 'REPLIED', 'WON', 'DEAD'];

export interface Lead {
  id: string;
  name: string;
  stage: LeadStage;
  fit?: number;         // 1-10 score
  dossier?: string;
  source?: string;      // URL
  createdAt: number;
  updatedAt: number;
}

const KEY = 'kai.leads';

export function getLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(list: Lead[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

export function addLead(input: { name: string; stage?: LeadStage; fit?: number; dossier?: string; source?: string }): Lead {
  const lead: Lead = {
    id: 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: input.name.trim(), stage: input.stage || 'FOUND',
    fit: input.fit, dossier: input.dossier, source: input.source,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const list = getLeads(); list.unshift(lead); save(list);
  try { logEvent({ domain: 'leads', type: 'found', meta: { id: lead.id, name: lead.name }, source: 'ai' }); } catch { /* ignore */ }
  return lead;
}

export function moveLead(id: string, stage: LeadStage): void {
  const list = getLeads();
  const l = list.find(x => x.id === id);
  if (!l) return;
  l.stage = stage; l.updatedAt = Date.now();
  save(list);
  try { logEvent({ domain: 'leads', type: 'stage_changed', meta: { id, stage }, source: 'user' }); } catch { /* ignore */ }
}

export function removeLead(id: string): void {
  save(getLeads().filter(l => l.id !== id));
}

/* Pipeline counts by stage — feeds the organ signal + Ask-KAI. */
export function leadCounts(): Record<LeadStage, number> {
  const out = { FOUND: 0, RESEARCHED: 0, DRAFTED: 0, SENT: 0, REPLIED: 0, WON: 0, DEAD: 0 } as Record<LeadStage, number>;
  for (const l of getLeads()) out[l.stage]++;
  return out;
}

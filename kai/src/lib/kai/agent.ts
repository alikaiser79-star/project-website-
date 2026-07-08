/* ============================================================
   KAI Mission Engine — client side. Holds missions (localStorage),
   ticks them against /api/agent (server runs one tool-use round per
   tick with a fresh Spine snapshot), and surfaces steps/proposals.

   Nothing external executes here: the server's propose_action only
   queues proposals; approval + execution stays at the Gate.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments } from './commitments';
import { getLeads } from './leads';

export type MissionStatus = 'queued' | 'running' | 'paused' | 'done' | 'failed';
export interface MissionStep { kind: string; tool?: string; text?: string; at?: number; }
export interface MissionProposal { type: string; summary: string; payload: any; status: string; }
export interface MissionArtifact { kind: string; title: string; body: string; }
export interface Mission {
  id: string;
  goal: string;
  preset?: string;
  status: MissionStatus;
  steps: MissionStep[];
  artifacts: MissionArtifact[];
  proposals: MissionProposal[];
  tokensUsed: number;
  tokenBudget: number;
  startedAt: number;
  messages: any[];
}

export interface Preset { id: string; label: string; hint: string; template: string; }
export const PRESETS: Preset[] = [
  { id: 'prospector', label: 'PROSPECTOR', hint: 'Find + score leads', template: 'Find 5 German D2C brands that would fit a CX/support retainer. For each: research site, rough size, and support channels; score fit 1-10; write a 5-line dossier with source URLs. Save each as a lead.' },
  { id: 'outreach', label: 'OUTREACH', hint: 'Draft a cold email', template: 'For the top lead, draft a cold email IN GERMAN in Ali\'s voice (calm, direct, no fluff): subject + body + a one-line follow-up, personalised from the dossier. Propose it as an email_draft — do not send.' },
  { id: 'siteforge', label: 'SITEFORGE', hint: 'Generate a landing page', template: 'Generate a complete single-file HTML landing page for FRISCH with real copy, sections, and a CTA (client-appropriate branding — not crimson/gold). Return the full HTML as the artifact.' },
  { id: 'market_eye', label: 'MARKET EYE', hint: 'Sourced market brief', template: 'Search current data on Hurghada / Makadi short-term nightly rates. Return a sourced brief with real numbers and links — every figure carries its source URL.' },
];

const KEY = 'kai.missions';
const MAX_TICKS = 14;   // client safety over the server's 12-step cap

function load(): Mission[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function persist(list: Mission[]) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-20))); } catch { /* ignore */ } }

export function getMissions(): Mission[] { return load(); }
export function activeMissions(): Mission[] { return load().filter(m => m.status === 'running' || m.status === 'queued'); }

function upsert(m: Mission) {
  const list = load();
  const i = list.findIndex(x => x.id === m.id);
  if (i >= 0) list[i] = m; else list.push(m);
  persist(list);
}

export function launchMission(goal: string, preset?: string): Mission {
  const m: Mission = {
    id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    goal: goal.trim(), preset, status: 'running',
    steps: [], artifacts: [], proposals: [], tokensUsed: 0, tokenBudget: 120_000,
    startedAt: Date.now(), messages: [],
  };
  upsert(m);
  try { logEvent({ domain: 'agent', type: 'mission_launched', meta: { id: m.id, goal: m.goal }, source: 'ai' }); } catch { /* ignore */ }
  return m;
}

export function setMissionStatus(id: string, status: MissionStatus) {
  const list = load();
  const m = list.find(x => x.id === id);
  if (m) { m.status = status; persist(list); }
}

function spineSnapshot() {
  return {
    events: getEvents({}).slice(-120),
    commitments: getCommitments(),
    leads: getLeads(),
  };
}

async function tickOnce(mission: Mission): Promise<Mission> {
  const res = await fetch('/api/agent/tick', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mission, spine: spineSnapshot() }),
  });
  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) throw new Error('AGENT_' + res.status);
  const data = await res.json();
  return data.mission as Mission;
}

/* Run a mission to completion, one server tick at a time. onUpdate
   fires after each tick with the latest state. Honors the kill switch
   (status flipped to paused elsewhere) and the tick cap. */
export async function runMission(mission: Mission, onUpdate: (m: Mission) => void): Promise<Mission> {
  let m = mission;
  for (let i = 0; i < MAX_TICKS; i++) {
    /* re-read status so a pause/kill from the UI takes effect */
    const current = load().find(x => x.id === m.id);
    if (current && current.status !== 'running') { onUpdate(current); return current; }
    try {
      m = await tickOnce(m);
    } catch (e: any) {
      m = { ...m, status: 'failed', steps: [...m.steps, { kind: 'error', text: String(e?.message || e).includes('NO_API_KEY') ? 'No API key wired on the server.' : 'Agent tick failed.' }] };
      upsert(m); onUpdate(m); return m;
    }
    upsert(m);
    try { logEvent({ domain: 'agent', type: 'step', value: m.steps.length, meta: { id: m.id, last: m.steps[m.steps.length - 1]?.kind }, source: 'ai' }); } catch { /* ignore */ }
    onUpdate(m);
    if (m.status !== 'running') return m;
  }
  m = { ...m, status: m.status === 'running' ? 'paused' : m.status };
  upsert(m); onUpdate(m);
  return m;
}

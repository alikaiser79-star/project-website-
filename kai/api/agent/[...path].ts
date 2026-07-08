/* ============================================================
   /api/agent — KAI Mission Engine (server-side, Edge).

   Stateless per-tick runner: the CLIENT holds the mission and posts
   it back each tick with a fresh Spine snapshot; the server advances
   ONE Anthropic tool-use round and returns the updated mission. No
   cron, no daemons — safe on Hobby. One catch-all route (function #6).

   Keys live only here: ANTHROPIC_API_KEY (the model), TAVILY_API_KEY
   (web_search). The browser never sees them.

   Tools exposed to the model:
     web_search(query)   → Tavily results (title/url/snippet)
     fetch_url(url)      → readable text, 10s timeout + size cap
     read_spine(query)   → read-only over the posted Spine snapshot
     propose_action(...) → DOES NOT EXECUTE; queues a proposal for the
                           ConfirmationGate. The agent proposes; Ali fires.

   Guardrails: <=12 tool steps/mission, a per-mission token budget, and
   the client's own kill switch (status flips to paused/failed).
   ============================================================ */

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_STEPS = 12;
const DEFAULT_TOKEN_BUDGET = 120_000;
const FETCH_CAP = 12_000;      // chars of extracted page text
const AGENT_SYSTEM =
  `You are KAI's mission agent, working for Ali Kaiser (Cairo — Hidden Garden, Makadi ` +
  `Airbnb, a German CX agency, FRISCH). Work the goal step by step with the tools. Rules:\n` +
  `- Evidence-based: every factual claim in a dossier/brief carries its source URL. No ` +
  `source → say so.\n` +
  `- You CANNOT send, publish, deploy, or buy anything. To make anything happen in the ` +
  `outside world, call propose_action — it queues for Ali's approval and does nothing on ` +
  `its own.\n- Be concise and concrete; when the goal is met, stop and give the result.`;

const TOOLS = [
  { name: 'web_search', description: 'Search the live web. Returns titles, URLs and snippets.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'fetch_url', description: 'Fetch a URL and return its readable text (truncated).', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'read_spine', description: 'Read-only query over Ali\'s Spine snapshot (events, commitments, leads).', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'propose_action', description: 'Queue an external action for Ali to approve at the Gate. Never executes.', input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['email_draft', 'site_deploy', 'task', 'lead_update'] }, summary: { type: 'string' }, payload: { type: 'object' } }, required: ['type', 'summary'] } },
];

function j(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,OPTIONS', 'cache-control': 'no-cache' } });
}

/* ── tool executors ─────────────────────────────────────── */
async function webSearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return 'web_search unavailable — set TAVILY_API_KEY in the server env.';
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: 5, search_depth: 'basic' }),
    });
    if (!r.ok) return `web_search failed (${r.status}).`;
    const d: any = await r.json();
    const results = (d.results || []).map((x: any) => `- ${x.title}\n  ${x.url}\n  ${String(x.content || '').slice(0, 240)}`).join('\n');
    return results || 'No results.';
  } catch (e: any) { return `web_search error: ${String(e?.message || e)}`; }
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'KAI-Agent/1.0' } });
    clearTimeout(t);
    if (!r.ok) return `fetch_url failed (${r.status}).`;
    const html = (await r.text()).slice(0, 200_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, FETCH_CAP);
  } catch (e: any) { return `fetch_url error: ${String(e?.message || e)}`; }
}

function readSpine(query: string, spine: any): string {
  try {
    const ev = Array.isArray(spine?.events) ? spine.events : [];
    const cm = Array.isArray(spine?.commitments) ? spine.commitments : [];
    const ld = Array.isArray(spine?.leads) ? spine.leads : [];
    const byDomain: Record<string, number> = {};
    for (const e of ev) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    return `query: ${query}\nevents: ${ev.length} (${Object.entries(byDomain).map(([d, n]) => `${d}×${n}`).join(', ')})\n` +
      `open commitments: ${cm.filter((c: any) => c.status === 'open').length}\nleads: ${ld.length} (${ld.map((l: any) => l.stage).join(',')})\n` +
      `recent events:\n${ev.slice(-12).map((e: any) => `  ${e.domain}.${e.type}${typeof e.value === 'number' ? ' ' + e.value : ''}`).join('\n')}`;
  } catch { return 'read_spine: snapshot unavailable.'; }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,OPTIONS' } });
  if (req.method !== 'POST') return j({ error: 'method_not_allowed' }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return j({ error: 'no_api_key' }, 503);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: 'bad_body' }, 400); }
  const mission = body?.mission;
  const spine = body?.spine || {};
  if (!mission || typeof mission.goal !== 'string') return j({ error: 'no_mission' }, 400);

  /* terminal / guardrail states → return unchanged */
  if (mission.status !== 'running') return j({ mission });
  const stepCount = Array.isArray(mission.steps) ? mission.steps.length : 0;
  if (stepCount >= MAX_STEPS) { mission.status = 'done'; mission.steps.push({ kind: 'note', text: `Step cap (${MAX_STEPS}) reached.`, at: mission.startedAt }); return j({ mission }); }
  if ((mission.tokensUsed || 0) > (mission.tokenBudget || DEFAULT_TOKEN_BUDGET)) { mission.status = 'paused'; return j({ mission }); }

  const messages = Array.isArray(mission.messages) && mission.messages.length
    ? mission.messages
    : [{ role: 'user', content: `MISSION: ${mission.goal}` }];

  let resp: any;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1400, system: AGENT_SYSTEM, tools: TOOLS, messages }),
    });
    if (r.status === 503) return j({ error: 'no_api_key' }, 503);
    if (!r.ok) { mission.status = 'failed'; mission.steps = mission.steps || []; mission.steps.push({ kind: 'error', text: `model ${r.status}`, at: Date.now?.() ?? 0 }); return j({ mission }); }
    resp = await r.json();
  } catch (e: any) {
    mission.status = 'failed';
    mission.steps = mission.steps || [];
    mission.steps.push({ kind: 'error', text: String(e?.message || e) });
    return j({ mission });
  }

  mission.tokensUsed = (mission.tokensUsed || 0) + (resp?.usage?.input_tokens || 0) + (resp?.usage?.output_tokens || 0);
  mission.steps = mission.steps || [];
  mission.artifacts = mission.artifacts || [];
  mission.proposals = mission.proposals || [];
  messages.push({ role: 'assistant', content: resp.content });

  if (resp.stop_reason === 'tool_use') {
    const toolResults: any[] = [];
    for (const block of resp.content) {
      if (block.type === 'text' && block.text.trim()) mission.steps.push({ kind: 'think', text: block.text.trim() });
      if (block.type !== 'tool_use') continue;
      const name = block.name, input = block.input || {};
      let result = '';
      if (name === 'web_search') { result = await webSearch(input.query || ''); mission.steps.push({ kind: 'tool', tool: 'web_search', text: input.query, at: 0 }); }
      else if (name === 'fetch_url') { result = await fetchUrl(input.url || ''); mission.steps.push({ kind: 'tool', tool: 'fetch_url', text: input.url }); }
      else if (name === 'read_spine') { result = readSpine(input.query || '', spine); mission.steps.push({ kind: 'tool', tool: 'read_spine', text: input.query }); }
      else if (name === 'propose_action') {
        mission.proposals.push({ type: input.type, summary: input.summary, payload: input.payload || {}, status: 'pending' });
        mission.steps.push({ kind: 'propose', tool: 'propose_action', text: `${input.type}: ${input.summary}` });
        result = 'Queued for Ali\'s approval at the Gate. It has NOT executed.';
      } else result = `Unknown tool: ${name}`;
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: String(result).slice(0, 16_000) });
    }
    messages.push({ role: 'user', content: toolResults });
    mission.messages = messages;
    return j({ mission });                    // client re-ticks
  }

  /* end_turn — final text = the mission result / artifact */
  const finalText = (resp.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  if (finalText) { mission.steps.push({ kind: 'result', text: finalText }); mission.artifacts.push({ kind: 'text', title: 'Result', body: finalText }); }
  mission.status = 'done';
  mission.messages = messages;
  return j({ mission });
}

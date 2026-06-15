/* ─────────────────────────────────────────────────────────
   Anthropic API caller — OPTIONAL.

   ▸ To enable: put your key in src/kaiConfig.ts → claudeConfig.apiKey
     OR create a `.env.local` with:
         VITE_ANTHROPIC_API_KEY=sk-ant-…
     and restart `npm run dev`.

   ⚠ This calls the Anthropic API directly from the browser. For
   production, route this through your own backend so the key never
   ships to clients. The browser request requires the dangerous header
   "anthropic-dangerous-direct-browser-access: true" — included below.
───────────────────────────────────────────────────────── */

import { claudeConfig } from '../kaiConfig';
import type { ChatTurn } from '../types';
import { TOOL_SCHEMAS, runTool, ToolCall } from './tools';

function buildMessages(prompt: string, history: ChatTurn[]) {
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const h of history.slice(-6)) {
    if (h.you) turns.push({ role: 'user',      content: h.you });
    if (h.kai) turns.push({ role: 'assistant', content: h.kai });
  }
  turns.push({ role: 'user', content: prompt });
  return turns;
}

/* Streamed variant — calls onDelta(chunk) as text tokens arrive.
   Now handles tool_use rounds automatically: when Claude calls a
   tool, we execute it locally, append a tool_result message, and
   continue streaming until end_turn. */
export async function askClaudeStream(
  prompt: string,
  history: ChatTurn[],
  onDelta: (chunk: string) => void,
  onTool?: (call: ToolCall, result: string) => void,
): Promise<string> {
  if (!claudeConfig.enabled || !claudeConfig.apiKey) throw new Error('NO_API_KEY');

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = buildMessages(prompt, history);
  let full = '';

  for (let round = 0; round < 4; round++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': claudeConfig.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: claudeConfig.model,
        max_tokens: 800,
        system: claudeConfig.systemPrompt,
        messages,
        tools: TOOL_SCHEMAS,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 200));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let stopReason: string | null = null;
    /* Accumulators for the assistant turn we're building from the stream. */
    const blocks: any[] = [];
    /* Per-content-block state: index → { type, jsonAcc?, textAcc? } */
    const blockState = new Map<number, { type: 'text' | 'tool_use'; text?: string; tool?: any; jsonAcc?: string }>();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'content_block_start') {
              const bi = ev.index as number;
              if (ev.content_block?.type === 'tool_use') {
                blockState.set(bi, { type: 'tool_use', tool: { ...ev.content_block }, jsonAcc: '' });
              } else if (ev.content_block?.type === 'text') {
                blockState.set(bi, { type: 'text', text: '' });
              }
            }
            else if (ev.type === 'content_block_delta') {
              const bi = ev.index as number;
              const st = blockState.get(bi);
              if (!st) continue;
              if (ev.delta?.type === 'text_delta' && st.type === 'text') {
                st.text += ev.delta.text;
                full += ev.delta.text;
                onDelta(ev.delta.text);
              } else if (ev.delta?.type === 'input_json_delta' && st.type === 'tool_use') {
                st.jsonAcc = (st.jsonAcc || '') + ev.delta.partial_json;
              }
            }
            else if (ev.type === 'content_block_stop') {
              const bi = ev.index as number;
              const st = blockState.get(bi);
              if (!st) continue;
              if (st.type === 'text') {
                blocks.push({ type: 'text', text: st.text || '' });
              } else if (st.type === 'tool_use') {
                let input: any = {};
                try { input = st.jsonAcc ? JSON.parse(st.jsonAcc) : {}; } catch { input = {}; }
                blocks.push({ ...st.tool, input });
              }
            }
            else if (ev.type === 'message_delta') {
              if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
            }
          } catch { /* tolerate partial frames */ }
        }
      }
    }

    /* Record the assistant turn. */
    messages.push({ role: 'assistant', content: blocks });

    if (stopReason !== 'tool_use') {
      return full;
    }

    /* Execute every tool_use block in this turn and post results back. */
    const tool_results: any[] = [];
    for (const b of blocks) {
      if (b.type === 'tool_use') {
        try {
          const result = await runTool({ id: b.id, name: b.name, input: b.input });
          onTool?.({ id: b.id, name: b.name, input: b.input }, result);
          tool_results.push({ type: 'tool_result', tool_use_id: b.id, content: result });
        } catch (e: any) {
          tool_results.push({ type: 'tool_result', tool_use_id: b.id, content: 'error: ' + (e?.message || 'unknown'), is_error: true });
        }
      }
    }
    messages.push({ role: 'user', content: tool_results });
    /* Loop again — Claude will see the tool results and produce more text or another tool round. */
  }
  return full;
}

export async function askClaude(prompt: string, history: ChatTurn[] = []): Promise<string> {
  if (!claudeConfig.enabled || !claudeConfig.apiKey) {
    throw new Error('NO_API_KEY');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': claudeConfig.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: claudeConfig.model,
      max_tokens: 400,
      system: claudeConfig.systemPrompt,
      messages: buildMessages(prompt, history),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 200));
  }
  const data = await res.json();
  const text = (data?.content?.[0]?.text || '').trim();
  return text || '…';
}

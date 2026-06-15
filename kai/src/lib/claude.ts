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
   Resolves with the full text on completion. */
export async function askClaudeStream(
  prompt: string,
  history: ChatTurn[],
  onDelta: (chunk: string) => void,
): Promise<string> {
  if (!claudeConfig.enabled || !claudeConfig.apiKey) throw new Error('NO_API_KEY');

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
      max_tokens: 600,
      system: claudeConfig.systemPrompt,
      messages: buildMessages(prompt, history),
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
  let full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines.
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      // Each frame can have one or more `data: …` lines
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            const t = ev.delta.text as string;
            full += t;
            onDelta(t);
          }
        } catch { /* ignore parse errors mid-frame */ }
      }
    }
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

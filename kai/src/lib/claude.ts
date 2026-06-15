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

export async function askClaude(prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
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

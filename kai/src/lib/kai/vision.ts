/* ============================================================
   THE EYE (§10.2) — plant vision. Compresses captured frames
   client-side (~1024px JPEG) and sends them, with the plant's Codex
   record as context, to Claude (multimodal, via the existing
   /api/claude proxy — no new function). Returns a structured read:
   identification, health, confidence, the one move now, and what to
   watch for. Honest rule baked into the prompt: uncertain = say so
   and ask for a closer shot, never confidently wrong.
   ============================================================ */

import { claudeConfig } from '../../kaiConfig';
import type { Plant, PlantDiagnosis, PlantHealth, IdConfidence } from '../../types';

export interface Frame { jpegDataUrl: string; base64: string; }

/* Draw a source (video frame or image) to a canvas, scaled so the long
   edge is <= max px, exported as a JPEG data URL. */
export function encodeFrame(source: CanvasImageSource, sw: number, sh: number, max = 1024, quality = 0.82): Frame {
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
  return { jpegDataUrl, base64: jpegDataUrl.split(',')[1] || '' };
}

/* Small thumbnail data URL (~140px) for the Codex record. */
export function thumbnail(source: CanvasImageSource, sw: number, sh: number): string {
  return encodeFrame(source, sw, sh, 140, 0.7).jpegDataUrl;
}

/* Load a File/Blob into an <img> so it can be re-encoded to the target size. */
export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => { resolve(img); if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = reject;
    img.src = url;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(head)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const SYSTEM =
  `You are KAI's garden eye — a careful, honest horticulturist for Hidden Garten, a premium ` +
  `garden in Maadi, Cairo (hot arid climate, hard water, intense summer sun). You are shown 1-3 ` +
  `photos of ONE plant plus its Codex record. Diagnose ONLY from what you can actually see in ` +
  `the images. Do not invent detail. If identification or the health read is uncertain, set a low ` +
  `confidence, say what's ambiguous, and in "move" ask for a specific closer shot (e.g. "show me ` +
  `the underside of a leaf"). Never be confidently wrong. Consider Cairo conditions (heat/light ` +
  `stress, salt/lime from hard water, spider mites in dry heat) when relevant.`;

function outputSpec(): string {
  return `\n\nReturn ONLY a JSON object, no prose, with exactly these keys:\n` +
    `{\n` +
    `  "identification": string | null,   // species/cultivar if you can refine it, else null\n` +
    `  "health": string,                  // what you SEE: deficiency, pest, stress, or thriving\n` +
    `  "confidence": "high" | "med" | "low",\n` +
    `  "move": string,                    // the ONE action to take now (or the closer shot to send)\n` +
    `  "watchFor": string,                // what to re-check in ~7 days\n` +
    `  "healthStatus": "thriving" | "watch" | "ailing" | "unknown"\n` +
    `}`;
}

function plantContext(p: Plant): string {
  const bits = [
    `name: ${p.name}`,
    p.species ? `recorded species: ${p.species}` : 'recorded species: unknown',
    p.zone ? `zone: ${p.zone}` : '',
    p.ageYears ? `age: ~${p.ageYears} yr` : '',
    p.lastWateredAt ? `last watered: ${Math.round((Date.now() - p.lastWateredAt) / 86_400_000)}d ago` : 'last watered: unknown',
    p.health ? `current health flag: ${p.health}` : '',
    p.diagnoses.length ? `previous read: ${p.diagnoses[p.diagnoses.length - 1].health || '—'}` : '',
    p.notes ? `notes: ${p.notes}` : '',
  ].filter(Boolean);
  return bits.join('\n');
}

function parseJson(text: string): any | null {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return null;
}

const HEALTHS: PlantHealth[] = ['thriving', 'watch', 'ailing', 'unknown'];
const CONFS: IdConfidence[] = ['high', 'med', 'low'];

export interface DiagnosisResult {
  diagnosis: PlantDiagnosis;
  healthStatus: PlantHealth;
  raw: string;
}

export async function diagnosePlant(plant: Plant, frames: Frame[], photoId?: string): Promise<DiagnosisResult> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');
  if (!frames.length) throw new Error('no frames');

  const content: any[] = frames.map((f) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: f.base64 },
  }));
  content.push({ type: 'text', text: `PLANT RECORD:\n${plantContext(plant)}${outputSpec()}` });

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.modelHeavy,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });
  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) throw new Error('API_ERROR: ' + res.status + ' ' + (await res.text()).slice(0, 160));

  const data = await res.json();
  try { const u = data?.usage; const { logTokens } = await import('./tokens'); logTokens('vision', u?.input_tokens || 0, u?.output_tokens || 0, claudeConfig.modelHeavy); } catch { /* ignore */ }
  const raw = (data?.content?.[0]?.text || '').trim();
  const parsed = parseJson(raw) || {};

  const confidence: IdConfidence = CONFS.includes(parsed.confidence) ? parsed.confidence : 'low';
  const healthStatus: PlantHealth = HEALTHS.includes(parsed.healthStatus) ? parsed.healthStatus : 'unknown';
  const diagnosis: PlantDiagnosis = {
    at: Date.now(),
    identification: parsed.identification || undefined,
    health: parsed.health || raw.slice(0, 200) || 'No clear read.',
    confidence,
    move: parsed.move || undefined,
    watchFor: parsed.watchFor || undefined,
    photoId,
  };
  return { diagnosis, healthStatus, raw };
}

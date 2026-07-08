/* ============================================================
   GARTEN CODEX (§10.1) — the plant registry. A grid of every tree
   and plant in Hidden Garten, one card each: latest photo thumbnail
   + a health dot (green thriving / amber watch / crimson ailing /
   grey unknown). Tap a card to open its record — species, zone,
   age/heritage, notes, photo history, water log, health. The camera
   "SHOW KAI" diagnosis (§10.2) mounts into this detail next.
   ============================================================ */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Leaf, Plus, Droplet, X, Trash2, Camera } from 'lucide-react';
import { subscribe, getVersion } from '../../lib/kai/store';
import {
  listPlants, getPlant, addPlant, updatePlant, removePlant,
  setHealth, logWatering, HEALTH_META,
  dueToday, generateMasterplan, isHeatwave, getCachedTempC,
} from '../../lib/kai/garden';
import type { Plant, PlantHealth } from '../../types';
import { operator } from '../../kaiConfig';
import { toast } from '../../hooks/useToasts';
import GardenEye from '../GardenEye';
import { Sparkles, Droplets } from 'lucide-react';

const HEALTHS: PlantHealth[] = ['thriving', 'watch', 'ailing', 'unknown'];

function ageLabel(p: Plant): string {
  if (p.ageYears) return `${p.ageYears} yr`;
  if (p.plantedAt) return `${Math.max(0, Math.round((Date.now() - p.plantedAt) / (365 * 86_400_000)))} yr`;
  return '—';
}
function whenLabel(ms?: number): string {
  if (!ms) return 'never';
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

export default function GartenCodexPanel() {
  /* live re-read on any Spine write */
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const plants = listPlants();
  const due = dueToday();
  const [openId, setOpenId] = useState<string | null>(null);
  const [eyeId, setEyeId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  async function masterplan() {
    if (planning) return;
    setPlanning(true);
    try {
      const r = await generateMasterplan();
      if (r.ok) toast.ok(`Care masterplan generated for ${r.updated} plants.`, 'GÄRTNER', 3500);
      else toast.err(r.reason === 'NO_API_KEY' ? 'Masterplan needs the API key wired on the server.' : 'Could not generate the masterplan.');
    } finally { setPlanning(false); }
  }

  return (
    <section className="glass rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-emerald-300/90">
          <Leaf size={14} />
          <span className="font-mono text-[11px] tracking-[0.22em] uppercase">Garten Codex</span>
          <span className="font-mono text-[10px] text-steel/60">· {plants.length} catalogued</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={masterplan} disabled={planning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-emerald-400/40 text-emerald-300 hover:border-emerald-300 rounded text-[10px] tracking-[0.14em] uppercase disabled:opacity-50"
            title="Generate a per-plant seasonal care plan"
          >
            <Sparkles size={12} /> {planning ? 'Planning…' : 'Masterplan'}
          </button>
          <button
            onClick={() => { const p = addPlant({ name: 'Unidentified' }); setEyeId(p.id); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-emerald-400/40 text-emerald-300 hover:border-emerald-300 rounded text-[10px] tracking-[0.14em] uppercase"
            title="Point the camera at any plant"
          >
            <Camera size={12} /> Show KAI
          </button>
          <button
            onClick={() => { const p = addPlant({ name: 'New plant' }); setOpenId(p.id); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-emerald-400/40 text-emerald-300 hover:border-emerald-300 rounded text-[10px] tracking-[0.14em] uppercase"
          >
            <Plus size={12} /> Register
          </button>
        </div>
      </div>

      {/* §10.3 — today's watering list */}
      {due.length > 0 && (
        <div className="garten-water-strip">
          <span className="garten-water-lead"><Droplets size={12} /> Water today{isHeatwave() ? ` · heatwave ${getCachedTempC()}°C` : ''}:</span>
          {due.map((p) => (
            <button key={p.id} className="garten-water-chip" onClick={() => { logWatering(p.id); toast.ok(`Logged watering · ${p.name}`, 'GÄRTNER', 2500); }}>
              <Droplet size={10} /> {p.zone || p.name}
            </button>
          ))}
        </div>
      )}

      {plants.length === 0 ? (
        <div className="font-mono text-steel/55 text-[12px] py-6 text-center">No plants yet — register the garden.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {plants.map((p) => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="garten-card group">
              <div className="garten-thumb">
                {p.photos.length ? <img src={p.photos[p.photos.length - 1].thumb} alt={p.name} />
                  : <Leaf size={22} className="text-emerald-400/30" />}
                <span className="garten-dot" style={{ background: HEALTH_META[p.health].dot }} />
              </div>
              <div className="garten-name" title={p.name}>{p.name}</div>
              <div className="garten-sub">{p.species || 'species —'}</div>
              <div className="garten-sub2">{p.zone || 'zone —'} · {ageLabel(p)}</div>
            </button>
          ))}
        </div>
      )}

      {openId && <PlantDetail id={openId} onClose={() => setOpenId(null)} onShowKai={() => { const id = openId; setOpenId(null); setEyeId(id); }} />}
      {eyeId && <GardenEye plantId={eyeId} onClose={() => setEyeId(null)} />}
    </section>
  );
}

function PlantDetail({ id, onClose, onShowKai }: { id: string; onClose: () => void; onShowKai: () => void }) {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const plant = getPlant(id);
  const [local, setLocal] = useState<Plant | undefined>(plant);
  useEffect(() => { setLocal(getPlant(id)); }, [id]);
  if (!plant || !local) return null;

  const cur = local;   // narrowed — guarded non-null above
  function field<K extends keyof Plant>(k: K, v: Plant[K]) { setLocal({ ...cur, [k]: v }); }
  function commit() { updatePlant(id, {
    name: cur.name, species: cur.species, zone: cur.zone,
    ageYears: cur.ageYears, heritage: cur.heritage, notes: cur.notes,
  }); }

  return (
    <div className="garten-scrim" data-noswipe onClick={() => { commit(); onClose(); }}>
      <div className="garten-sheet" role="dialog" aria-label={local.name} data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="garten-head">
          <span className="flex items-center gap-2">
            <span className="garten-dot-lg" style={{ background: HEALTH_META[local.health].dot }} />
            <input className="garten-title-input" value={local.name} onChange={(e) => field('name', e.target.value)} />
          </span>
          <button className="share-x" onClick={() => { commit(); onClose(); }} aria-label="close"><X size={14} /></button>
        </div>

        <button className="garten-showkai" onClick={() => { commit(); onShowKai(); }}>
          <Camera size={13} /> SHOW KAI — capture &amp; diagnose
        </button>

        {/* photo history strip */}
        <div className="garten-strip">
          {local.photos.length === 0 && <div className="garten-strip-empty">No captures yet — tap SHOW KAI to photograph and diagnose.</div>}
          {local.photos.slice().reverse().map((ph) => (
            <div key={ph.id} className="garten-strip-cell" title={new Date(ph.at).toLocaleString(operator.locale)}>
              <img src={ph.thumb} alt="capture" />
            </div>
          ))}
        </div>

        <div className="garten-grid2">
          <label className="garten-f"><span>Species</span>
            <input value={local.species || ''} onChange={(e) => field('species', e.target.value)} placeholder="e.g. Citrus limon" /></label>
          <label className="garten-f"><span>Zone</span>
            <input value={local.zone || ''} onChange={(e) => field('zone', e.target.value)} placeholder="e.g. South border" /></label>
          <label className="garten-f"><span>Age (yrs)</span>
            <input type="number" value={local.ageYears ?? ''} onChange={(e) => field('ageYears', e.target.value ? parseInt(e.target.value, 10) : undefined)} /></label>
          <label className="garten-f"><span>Watered</span>
            <div className="flex items-center gap-2">
              <span className="text-bone/70 text-[11px] tabular-nums">{whenLabel(local.lastWateredAt)}</span>
              <button onClick={() => logWatering(id)} className="garten-water"><Droplet size={11} /> log</button>
            </div>
          </label>
        </div>

        <label className="garten-f block mt-2"><span>Heritage / provenance</span>
          <textarea rows={2} value={local.heritage || ''} onChange={(e) => field('heritage', e.target.value)} placeholder="e.g. planted by Horst Kaiser; legal evidence" /></label>
        <label className="garten-f block mt-2"><span>Notes</span>
          <textarea rows={2} value={local.notes || ''} onChange={(e) => field('notes', e.target.value)} /></label>

        {local.carePlan && (
          <div className="garten-careplan"><div className="garten-careplan-h">CARE PLAN</div>{local.carePlan}</div>
        )}

        <div className="garten-health-row">
          {HEALTHS.map((h) => (
            <button key={h} onClick={() => setHealth(id, h)}
              className={'garten-health-chip' + (local.health === h ? ' on' : '')}
              style={local.health === h ? { borderColor: HEALTH_META[h].dot, color: HEALTH_META[h].dot } : undefined}>
              <span className="garten-dot" style={{ background: HEALTH_META[h].dot }} />{HEALTH_META[h].label}
            </button>
          ))}
        </div>

        <div className="garten-foot">
          <button className="garten-del" onClick={() => { if (confirm(`Remove ${local.name} from the Codex?`)) { removePlant(id); onClose(); } }}>
            <Trash2 size={11} /> Remove
          </button>
          <button className="garten-save" onClick={() => { commit(); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

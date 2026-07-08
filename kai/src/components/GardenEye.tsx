/* ============================================================
   THE EYE (§10.2) — "SHOW KAI". Point the camera at a plant, capture
   1-3 frames, and KAI reads it: identification, health, confidence,
   the one move now, and what to watch for. Frames are compressed
   client-side and sent to Claude vision via /api/claude. Full images
   are saved on-device (IndexedDB); a thumbnail + the diagnosis land in
   the plant's Codex history. Live camera via getUserMedia with an
   <input capture> fallback for browsers/permissions without it.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { Camera, X, Aperture, RefreshCw, Check } from 'lucide-react';
import { getPlant, addPhoto, addDiagnosis } from '../lib/kai/garden';
import { putPhoto } from '../lib/kai/photos';
import { encodeFrame, thumbnail, loadImage, dataUrlToBlob, diagnosePlant, type Frame, type DiagnosisResult } from '../lib/kai/vision';
import { uid } from '../lib/kai/store';
import { HEALTH_META } from '../lib/kai/garden';

const CONF_COLOR: Record<string, string> = { high: '#7AE6A8', med: '#FFB300', low: '#E0503A' };

export default function GardenEye({ plantId, onClose }: { plantId: string; onClose: () => void }) {
  const plant = getPlant(plantId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [frames, setFrames] = useState<Array<Frame & { thumb: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /* start the rear camera; fall back silently to the file input */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setLive(true);
      } catch { setLive(false); }   // permission denied / unsupported → file fallback
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  function pushFrame(f: Frame, thumb: string) {
    setFrames(prev => prev.length >= 3 ? prev : [...prev, { ...f, thumb }]);
    setResult(null); setSaved(false);
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const f = encodeFrame(v, v.videoWidth, v.videoHeight);
    const thumb = thumbnail(v, v.videoWidth, v.videoHeight);
    pushFrame(f, thumb);
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      const f = encodeFrame(img, img.naturalWidth, img.naturalHeight);
      const thumb = thumbnail(img, img.naturalWidth, img.naturalHeight);
      pushFrame(f, thumb);
    } catch { setErr('Could not read that image.'); }
  }

  async function diagnose() {
    if (!plant || !frames.length) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await diagnosePlant(plant, frames);
      setResult(r);
    } catch (e: any) {
      const m = String(e?.message || e);
      setErr(m.includes('NO_API_KEY') ? 'Vision is offline — no API key wired on the server.' : 'KAI could not read the plant just now.');
    } finally { setBusy(false); }
  }

  async function save() {
    if (!plant || !result) return;
    setBusy(true);
    try {
      let firstPhotoId: string | undefined;
      for (const fr of frames) {
        const id = 'ph-' + uid().slice(0, 10);
        if (!firstPhotoId) firstPhotoId = id;
        try { await putPhoto(id, dataUrlToBlob(fr.jpegDataUrl)); } catch { /* quota — thumb still lands */ }
        addPhoto(plant.id, { id, thumb: fr.thumb, at: Date.now(), note: result.diagnosis.health?.slice(0, 80) });
      }
      addDiagnosis(plant.id, { ...result.diagnosis, photoId: firstPhotoId }, result.healthStatus);
      setSaved(true);
      setTimeout(onClose, 650);
    } finally { setBusy(false); }
  }

  if (!plant) return null;
  const d = result?.diagnosis;
  const confColor = d ? (CONF_COLOR[d.confidence || 'low'] || '#E0503A') : '#999';

  return (
    <div className="eye-scrim" data-noswipe onClick={onClose}>
      <div className="eye-sheet" role="dialog" aria-label="Show KAI" data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="eye-head">
          <span className="flex items-center gap-2"><Camera size={14} className="text-emerald-300" /><span className="eye-title">SHOW KAI · {plant.name}</span></span>
          <button className="share-x" onClick={onClose} aria-label="close"><X size={14} /></button>
        </div>

        {/* viewfinder / file fallback */}
        <div className="eye-view">
          <video ref={videoRef} playsInline muted className={live ? 'eye-video on' : 'eye-video'} />
          {!live && (
            <label className="eye-file">
              <Camera size={26} className="text-emerald-400/50" />
              <span>Tap to take a photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
          )}
        </div>

        {/* captured strip */}
        {frames.length > 0 && (
          <div className="eye-strip">
            {frames.map((f, i) => <div key={i} className="eye-thumb"><img src={f.thumb} alt={`frame ${i + 1}`} /></div>)}
            {frames.length < 3 && <div className="eye-thumb-more">+{3 - frames.length} more</div>}
          </div>
        )}

        {/* controls */}
        {!result && (
          <div className="eye-controls">
            {live && <button className="eye-snap" onClick={snap} disabled={frames.length >= 3}><Aperture size={16} /> Capture</button>}
            {!live && frames.length > 0 && (
              <label className="eye-snap"><Aperture size={16} /> Add angle
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} /></label>
            )}
            <button className="eye-diagnose" onClick={diagnose} disabled={!frames.length || busy}>
              {busy ? 'Reading…' : 'Diagnose'}
            </button>
          </div>
        )}

        {err && <div className="eye-err">{err}</div>}

        {/* diagnosis */}
        {d && (
          <div className="eye-result">
            {d.identification && <div className="eye-row"><span className="eye-k">IDENTIFICATION</span><span className="eye-v">{d.identification}</span></div>}
            <div className="eye-row"><span className="eye-k">HEALTH READ</span><span className="eye-v">{d.health}</span></div>
            <div className="eye-row"><span className="eye-k">CONFIDENCE</span>
              <span className="eye-v" style={{ color: confColor }}>{(d.confidence || 'low').toUpperCase()}
                <span className="eye-dot" style={{ background: HEALTH_META[result!.healthStatus].dot }} /> {HEALTH_META[result!.healthStatus].label}</span></div>
            {d.move && <div className="eye-row"><span className="eye-k">THE MOVE</span><span className="eye-v eye-move">{d.move}</span></div>}
            {d.watchFor && <div className="eye-row"><span className="eye-k">WATCH FOR</span><span className="eye-v">{d.watchFor}</span></div>}

            <div className="eye-actions">
              <button className="eye-again" onClick={() => { setResult(null); }}><RefreshCw size={12} /> Capture more</button>
              <button className="eye-save" onClick={save} disabled={busy || saved}>
                {saved ? <><Check size={13} /> Saved</> : 'Save to Codex'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

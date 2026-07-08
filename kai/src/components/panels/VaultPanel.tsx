/* ============================================================
   THE VAULT panel (§6.4) — a grid of documents that open instantly,
   offline. Add a file, tap a card to open it (object URL from the
   local blob), long-hold-free delete. Sits behind the app's WebAuthn
   lock, so it's Face-ID gated by inheritance.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, FileText, Plus, X } from 'lucide-react';
import { addDoc, listDocs, openDocUrl, removeDoc, type VaultDoc } from '../../lib/kai/vault';

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export default function VaultPanel({ delay = 0 }: { delay?: number }) {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listDocs().then(setDocs).catch(() => {});
  useEffect(() => { refresh(); }, []);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return;
    for (const f of Array.from(files)) { try { await addDoc(f); } catch { /* ignore */ } }
    e.target.value = '';
    refresh();
  }

  async function open(id: string) {
    const url = await openDocUrl(id);
    if (url) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  }

  async function del(id: string) { await removeDoc(id); refresh(); }

  return (
    <motion.div
      data-panel="28"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Lock size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">The Vault</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase ml-auto">offline · {docs.length}</span>
      </div>

      <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {docs.map(d => (
          <div key={d.id} className="relative group">
            <button
              onClick={() => open(d.id)}
              className="w-full text-left border border-white/[0.08] rounded p-2.5 hover:border-amber/30 transition"
            >
              <FileText size={16} className="text-amber/70 mb-1.5" />
              <div className="font-mono text-[10px] text-bone/90 leading-tight break-words line-clamp-2">{d.name}</div>
              <div className="font-mono text-[8px] text-steel/50 mt-1">{fmtSize(d.size)}</div>
            </button>
            <button onClick={() => del(d.id)} className="absolute top-1 right-1 text-steel/40 hover:text-danger opacity-0 group-hover:opacity-100" aria-label="delete"><X size={11} /></button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-amber/25 rounded p-2.5 flex flex-col items-center justify-center gap-1 text-amber/60 hover:border-amber/50 hover:text-amber transition min-h-[76px]"
        >
          <Plus size={16} />
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase">Add</span>
        </button>
      </div>

      {docs.length === 0 && (
        <div className="font-mono text-[10px] text-steel/50 mt-2 leading-relaxed">Contracts, insurance, IDs, case files. Stored locally, opens with zero signal.</div>
      )}
    </motion.div>
  );
}

/* ============================================================
   IgFeedPanel — live Instagram Graph API state per account.

   Distinct from the existing InstagramPanel (which is a charts
   panel over follower history in the local store). This one
   reads the actual Graph API: live followers / posts / recent
   media with engagement.

   Read-only. Publishing goes through ⌘K → propose_ig_post →
   ConfirmationGate.
   ============================================================ */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Instagram, RefreshCw, Loader2, AlertTriangle, Heart, MessageCircle, Film, Image as ImageIcon, ExternalLink } from 'lucide-react';
import Panel from '../Panel';
import { sfx } from '../../lib/sound';

interface MediaItem {
  id: string;
  media_type: string;
  media_product_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  like_count: number | null;
  comments_count: number | null;
}
interface Account {
  key: string; label: string; handle: string;
  profile: {
    username: string;
    name: string | null;
    followers_count: number | null;
    follows_count: number | null;
    media_count: number | null;
  } | null;
  media: MediaItem[];
  error?: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'no_creds'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; accounts: Account[] };

export default function IgFeedPanel({ delay = 0 }: { delay?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  async function load() {
    setState({ kind: 'loading' });
    try {
      const r = await fetch('/api/ig/list');
      const data = await r.json().catch(() => ({}));
      if (r.status === 503) {
        setState({ kind: 'no_creds', message: String(data?.message || 'Instagram not connected') });
        return;
      }
      if (!r.ok) {
        setState({ kind: 'error', message: String(data?.message || `http ${r.status}`) });
        return;
      }
      setState({ kind: 'ok', accounts: Array.isArray(data?.accounts) ? data.accounts : [] });
    } catch (e: any) {
      setState({ kind: 'error', message: String(e?.message || 'fetch failed') });
    }
  }
  useEffect(() => { load(); }, []);

  const tag =
    state.kind === 'loading'  ? 'loading…' :
    state.kind === 'no_creds' ? 'not connected' :
    state.kind === 'error'    ? 'error' :
    state.kind === 'ok'       ? `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}` : '';

  return (
    <Panel num="15" title="Instagram · live" tag={tag} delay={delay}>
      <div className="space-y-3">
        {state.kind === 'ok' && (
          <div className="flex items-center justify-end">
            <button onClick={() => { sfx.click(); load(); }} className="p-1 text-steel hover:text-amber transition" title="Refresh">
              <RefreshCw size={11} />
            </button>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-8 font-mono text-[11px] text-steel">
            <Loader2 size={14} className="animate-spin text-amber mr-2" /> reading IG…
          </div>
        )}

        {state.kind === 'no_creds' && (
          <div className="px-3 py-3 border border-amber/20 rounded bg-amber/[0.04] text-bone/85 text-[11.5px] leading-relaxed">
            <strong className="text-amber font-medium">Instagram isn't connected yet.</strong>
            <p className="mt-1 text-steel">{state.message}</p>
            <ul className="mt-2 list-disc list-inside text-steel/85 space-y-0.5 font-mono text-[10.5px]">
              <li>IG_ACCESS_TOKEN — long-lived access token</li>
              <li>KAI_IG_ACCOUNTS — JSON array per account (key, label, handle, igUserId, accessToken?)</li>
            </ul>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="px-3 py-2 border border-danger/30 rounded bg-danger/[0.05] text-danger text-[11.5px] flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <div className="flex-1">{state.message}</div>
            <button onClick={load} className="text-amber hover:underline shrink-0">retry</button>
          </div>
        )}

        {state.kind === 'ok' && state.accounts.length === 0 && (
          <div className="px-3 py-4 border border-amber/15 rounded text-center">
            <Instagram size={18} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12px]">No accounts in KAI_IG_ACCOUNTS yet.</p>
          </div>
        )}

        {state.kind === 'ok' && state.accounts.length > 0 && (
          <ul className="space-y-4">
            <AnimatePresence initial={false}>
              {state.accounts.map(a => <AccountRow key={a.key} a={a} />)}
            </AnimatePresence>
          </ul>
        )}

        <p className="font-mono text-[9.5px] text-steel/60 leading-relaxed">
          Read-only. Posting goes through ⌘K → ConfirmationGate.
        </p>
      </div>
    </Panel>
  );
}

function AccountRow({ a }: { a: Account }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-2"
    >
      <div className="flex items-baseline gap-2">
        <Instagram size={11} className="text-amber/85 shrink-0" />
        <span className="font-sans text-bone text-[13px] truncate flex-1 min-w-0">{a.label}</span>
        {a.profile?.followers_count !== null && a.profile?.followers_count !== undefined && (
          <span className="font-mono text-[11px] tabular-nums text-bone/90 shrink-0">
            {(a.profile.followers_count).toLocaleString()} <span className="text-steel/70 text-[9px]">followers</span>
          </span>
        )}
      </div>

      {a.error && (
        <div className="flex items-start gap-1.5 text-danger/85 text-[10.5px]">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {a.error}
        </div>
      )}

      {a.profile && (
        <div className="flex items-center gap-3 font-mono text-[10px] text-steel/85 tracking-[0.04em]">
          {a.profile.media_count !== null && <span>{a.profile.media_count} posts</span>}
          {a.profile.follows_count !== null && <span>· {a.profile.follows_count} following</span>}
        </div>
      )}

      {a.media.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {a.media.slice(0, 6).map(m => <MediaTile key={m.id} m={m} />)}
        </div>
      )}
    </motion.li>
  );
}

function MediaTile({ m }: { m: MediaItem }) {
  const isReel = m.media_type === 'VIDEO' || m.media_product_type === 'REELS';
  return (
    <a
      href={m.permalink || undefined}
      target="_blank" rel="noreferrer"
      className="group relative aspect-square rounded overflow-hidden border border-amber/15 bg-ink2/40 block"
      title={m.caption || ''}
    >
      {m.thumbnail_url ? (
        <img src={m.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center text-steel/60">
          {isReel ? <Film size={16} /> : <ImageIcon size={16} />}
        </div>
      )}
      {isReel && (
        <span className="absolute top-1 right-1 p-0.5 rounded bg-black/55 text-bone">
          <Film size={9} />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1 flex items-center gap-1.5 font-mono text-[9px] text-bone/90 opacity-0 group-hover:opacity-100 transition">
        {m.like_count !== null && (
          <span className="flex items-center gap-0.5"><Heart size={8} /> {fmtCompact(m.like_count)}</span>
        )}
        {m.comments_count !== null && (
          <span className="flex items-center gap-0.5"><MessageCircle size={8} /> {fmtCompact(m.comments_count)}</span>
        )}
        <span className="ml-auto"><ExternalLink size={8} /></span>
      </div>
    </a>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

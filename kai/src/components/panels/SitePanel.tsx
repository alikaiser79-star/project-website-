/* ============================================================
   SitePanel — for every site in KAI_SITES, the most-recent
   Vercel deployment status with a link. Editing happens via
   ⌘K → propose_site_commit / propose_site_deploy → gate.
   ============================================================ */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, RefreshCw, Loader2, AlertTriangle, ExternalLink, GitCommit, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import Panel from '../Panel';
import { sfx } from '../../lib/sound';

type DeployState = 'READY' | 'BUILDING' | 'ERROR' | 'QUEUED' | 'CANCELED' | 'INITIALIZING' | 'UNKNOWN';

interface Deploy {
  uid: string;
  state: DeployState;
  url: string | null;
  createdAt: number;
  target: string;
  commit: string | null;
  message: string | null;
}
interface Site {
  key: string;
  label: string;
  owner: string;
  repo: string;
  branch: string;
  deployHook: boolean;
  deploys: Deploy[];
  error?: string;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'no_creds'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; sites: Site[] };

export default function SitePanel({ delay = 0 }: { delay?: number }) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  async function load() {
    setState({ kind: 'loading' });
    try {
      const r = await fetch('/api/site/deploys');
      const data = await r.json().catch(() => ({}));
      if (r.status === 503) {
        setState({ kind: 'no_creds', message: String(data?.message || 'Sites not connected') });
        return;
      }
      if (!r.ok) {
        setState({ kind: 'error', message: String(data?.message || `http ${r.status}`) });
        return;
      }
      setState({ kind: 'ok', sites: Array.isArray(data?.sites) ? data.sites : [] });
    } catch (e: any) {
      setState({ kind: 'error', message: String(e?.message || 'fetch failed') });
    }
  }
  useEffect(() => { load(); }, []);

  /* Auto-refresh every 30s while something's building so the
     state pill flips to READY without a manual reload. */
  useEffect(() => {
    if (state.kind !== 'ok') return;
    const anyBuilding = state.sites.some(s =>
      s.deploys.some(d => d.state === 'BUILDING' || d.state === 'QUEUED' || d.state === 'INITIALIZING'));
    if (!anyBuilding) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [state]);

  const tag =
    state.kind === 'loading'  ? 'loading…' :
    state.kind === 'no_creds' ? 'not connected' :
    state.kind === 'error'    ? 'error' :
    state.kind === 'ok'       ? `${state.sites.length} site${state.sites.length === 1 ? '' : 's'}` : '';

  return (
    <Panel num="14" title="Sites" tag={tag} delay={delay}>
      <div className="space-y-3">
        {state.kind === 'ok' && (
          <div className="flex items-center justify-end">
            <button
              onClick={() => { sfx.click(); load(); }}
              className="p-1 text-steel hover:text-amber transition"
              title="Refresh"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-8 font-mono text-[11px] text-steel">
            <Loader2 size={14} className="animate-spin text-amber mr-2" /> reading deploys…
          </div>
        )}

        {state.kind === 'no_creds' && (
          <div className="px-3 py-3 border border-amber/20 rounded bg-amber/[0.04] text-bone/85 text-[11.5px] leading-relaxed">
            <strong className="text-amber font-medium">Sites aren't connected yet.</strong>
            <p className="mt-1 text-steel">{state.message}</p>
            <ul className="mt-2 list-disc list-inside text-steel/85 space-y-0.5 font-mono text-[10.5px]">
              <li>GITHUB_TOKEN (fine-grained PAT, Contents read/write, scoped to target repos)</li>
              <li>VERCEL_TOKEN</li>
              <li>KAI_SITES — JSON array per site (key, label, owner, repo, branch, vercelProjectId, deployHook?)</li>
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

        {state.kind === 'ok' && state.sites.length === 0 && (
          <div className="px-3 py-4 border border-amber/15 rounded text-center">
            <Globe size={18} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12px]">No sites in KAI_SITES yet.</p>
          </div>
        )}

        {state.kind === 'ok' && state.sites.length > 0 && (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {state.sites.map(s => (
                <SiteRow key={s.key} site={s} />
              ))}
            </AnimatePresence>
          </ul>
        )}

        <p className="font-mono text-[9.5px] text-steel/60 leading-relaxed">
          Read-only. Commits &amp; deploys go through ⌘K → ConfirmationGate.
        </p>
      </div>
    </Panel>
  );
}

function SiteRow({ site }: { site: Site }) {
  const latest = site.deploys[0];
  return (
    <motion.li
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="px-3 py-2.5 border border-amber/15 rounded hover:border-amber/30 transition space-y-1.5"
    >
      <div className="flex items-baseline gap-2">
        <Globe size={11} className="text-amber/75 shrink-0" />
        <span className="font-sans text-bone text-[13px] truncate flex-1 min-w-0">{site.label}</span>
        {latest && <StatePill state={latest.state} />}
      </div>
      <div className="font-mono text-[10px] text-steel/75 tracking-[0.04em] truncate">
        {site.owner}/{site.repo} · {site.branch}
      </div>

      {site.error && (
        <div className="flex items-start gap-1.5 text-danger/85 text-[10.5px]">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {site.error}
        </div>
      )}

      {latest && (
        <div className="flex items-center gap-2 text-[10.5px]">
          {latest.commit && (
            <span className="flex items-center gap-1 text-steel/85 font-mono">
              <GitCommit size={9} /> {latest.commit}
            </span>
          )}
          {latest.message && (
            <span className="font-sans text-bone/80 truncate min-w-0 flex-1">{latest.message}</span>
          )}
          <span className="font-mono text-steel/65 shrink-0">{rel(latest.createdAt)}</span>
          {latest.url && (
            <a
              href={latest.url} target="_blank" rel="noreferrer"
              className="text-steel/60 hover:text-amber shrink-0" title="Open deployment"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {!latest && !site.error && (
        <div className="font-mono text-[10.5px] text-steel/70">No deployments yet.</div>
      )}
    </motion.li>
  );
}

function StatePill({ state }: { state: DeployState }) {
  const map: Record<DeployState, { icon: any; border: string; text: string; bg: string; label: string }> = {
    READY:        { icon: CheckCircle2, border: 'border-emerald/50', text: 'text-emerald', bg: 'bg-emerald/10', label: 'ready' },
    BUILDING:     { icon: Loader2,      border: 'border-amber/50',   text: 'text-amber',   bg: 'bg-amber/10',   label: 'building' },
    INITIALIZING: { icon: Loader2,      border: 'border-amber/50',   text: 'text-amber',   bg: 'bg-amber/10',   label: 'init' },
    QUEUED:       { icon: Hourglass,    border: 'border-cyan/50',    text: 'text-cyan',    bg: 'bg-cyan/10',    label: 'queued' },
    ERROR:        { icon: XCircle,      border: 'border-danger/50',  text: 'text-danger',  bg: 'bg-danger/10',  label: 'error' },
    CANCELED:     { icon: XCircle,      border: 'border-steel/40',   text: 'text-steel',   bg: '',              label: 'canceled' },
    UNKNOWN:      { icon: Hourglass,    border: 'border-steel/40',   text: 'text-steel',   bg: '',              label: 'unknown' },
  };
  const s = map[state] || map.UNKNOWN;
  const Icon = s.icon;
  const spin = state === 'BUILDING' || state === 'INITIALIZING';
  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[9.5px] tracking-[0.16em] uppercase shrink-0 ${s.border} ${s.text} ${s.bg}`}>
      <Icon size={9} className={spin ? 'animate-spin' : ''} />
      {s.label}
    </span>
  );
}

function rel(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60 * 60_000)      return Math.max(1, Math.round(diff / 60_000)) + 'm';
  if (diff < 24 * 60 * 60_000) return Math.round(diff / (60 * 60_000)) + 'h';
  if (diff < 7 * 86_400_000)   return Math.round(diff / 86_400_000) + 'd';
  try { return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

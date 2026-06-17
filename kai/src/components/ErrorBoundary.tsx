import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null; info: { componentStack?: string | null } | null };

/* Catches render-time exceptions anywhere below it in the tree and
   shows a styled fallback in place of a blank screen. Shows the full
   stack + React component stack so we can diagnose issues from the
   live site without DevTools. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    this.setState({ info });
    /* eslint-disable no-console */
    console.error('[KAI] render error caught by ErrorBoundary:', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private reset = () => {
    if (!confirm('Wipe local KAI state and reload?')) return;
    try { localStorage.removeItem('kai.state.v1'); } catch {}
    /* Also unregister the service worker + clear caches in case a stale
       precached bundle is the cause. */
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).catch(() => {});
      }
      if ('caches' in window) {
        caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).catch(() => {});
      }
    } catch {}
    window.location.reload();
  };

  private copy = async () => {
    const { error, info } = this.state;
    const text = [
      'KAI error report',
      '----------------',
      'name: '    + (error?.name || ''),
      'message: ' + (error?.message || ''),
      'stack:',
      error?.stack || '(no stack)',
      'componentStack:',
      info?.componentStack || '(no component stack)',
      'userAgent: ' + navigator.userAgent,
      'href: '      + location.href,
      'time: '      + new Date().toISOString(),
    ].join('\n');
    try { await navigator.clipboard.writeText(text); alert('Copied'); }
    catch { alert('Copy failed. Long-press the stack box and copy manually.'); }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const e = this.state.error;
    const stack = e.stack || '';
    const compStack = this.state.info?.componentStack || '';

    return (
      <div className="fixed inset-0 z-[9999] bg-ink text-bone grid place-items-center px-4 font-sans overflow-auto py-8">
        <div className="glass rounded-md p-6 max-w-[680px] w-full">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-amber text-2xl drop-shadow-[0_0_10px_rgba(255,179,0,0.6)] animate-pulse-soft">◊</span>
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-steel">KAI · halt</div>
              <h2 className="text-bone text-lg">Something threw on the way in.</h2>
            </div>
          </div>

          <div className="font-mono text-[11px] mb-1 text-amber/70">
            {e.name || 'Error'}
          </div>
          <pre className="font-mono text-[11px] leading-relaxed text-amber/85 bg-ink2/60 border border-amber/20 rounded p-3 overflow-auto whitespace-pre-wrap max-h-[35vh] select-text">
{e.message + '\n\n' + stack + (compStack ? '\n\nReact component stack:' + compStack : '')}
          </pre>

          <p className="font-mono text-[11px] text-steel mt-3 leading-relaxed">
            Local state is preserved unless you wipe it. If reload doesn't recover, a state wipe usually does — that also unregisters the service worker and clears caches in case the issue is a stale precached bundle.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={this.reload}
              className="px-3 py-2 border border-amber text-amber hover:bg-amber/10 hover:shadow-glow-amber rounded text-[11px] tracking-[0.16em] uppercase"
            >
              Reload
            </button>
            <button
              onClick={this.copy}
              className="px-3 py-2 border border-amber/40 text-amber/80 hover:border-amber hover:text-amber rounded text-[11px] tracking-[0.16em] uppercase"
            >
              Copy report
            </button>
            <button
              onClick={this.reset}
              className="px-3 py-2 border border-danger/50 text-danger hover:bg-danger/10 rounded text-[11px] tracking-[0.16em] uppercase"
            >
              Wipe state & reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

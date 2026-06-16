import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/* Catches render-time exceptions anywhere below it in the tree and
   shows a styled fallback in place of a blank screen. The fallback
   reuses the existing Tailwind tokens so it matches KAI's look. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    /* eslint-disable no-console */
    console.error('[KAI] render error caught by ErrorBoundary:', error, info);
  }

  private reload = () => {
    /* Hard reload — clears any half-mounted React state. */
    window.location.reload();
  };

  private reset = () => {
    if (!confirm('Wipe local KAI state and reload?')) return;
    try { localStorage.removeItem('kai.state.v1'); } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error.message || String(this.state.error);

    return (
      <div className="fixed inset-0 z-[9999] bg-ink text-bone grid place-items-center px-4 font-sans">
        <div className="glass rounded-md p-6 max-w-[520px] w-full">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-amber text-2xl drop-shadow-[0_0_10px_rgba(255,179,0,0.6)] animate-pulse-soft">◊</span>
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-steel">KAI · halt</div>
              <h2 className="text-bone text-lg">Something threw on the way in.</h2>
            </div>
          </div>

          <pre className="font-mono text-[11px] leading-relaxed text-amber/85 bg-ink2/60 border border-amber/20 rounded p-3 overflow-x-auto whitespace-pre-wrap">
{msg}
          </pre>

          <p className="font-mono text-[11px] text-steel mt-3 leading-relaxed">
            Local state is preserved. If reload doesn't recover, a state wipe usually does — your priorities, journal, and chat history are local-only so that's the heavy option.
          </p>

          <div className="flex gap-2 mt-4">
            <button
              onClick={this.reload}
              className="px-3 py-2 border border-amber text-amber hover:bg-amber/10 hover:shadow-glow-amber rounded text-[11px] tracking-[0.16em] uppercase"
            >
              Reload
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

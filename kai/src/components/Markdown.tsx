/* Tiny inline markdown renderer — supports **bold**, *italic*, `code`,
   bullet lists, numbered lists, links, and line breaks. Avoids a full
   library so the bundle stays lean. */

import { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0; let key = 0;
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > i) out.push(text.slice(i, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={key++} className="text-amber font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*') || tok.startsWith('_')) out.push(<em key={key++} className="text-amber/90 italic">{tok.slice(1, -1)}</em>);
    else if (tok.startsWith('`')) out.push(<code key={key++} className="font-mono text-cyan text-[12px] bg-cyan/10 px-1 rounded">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const label = tok.slice(1, tok.indexOf(']'));
      const url = tok.slice(tok.indexOf('(') + 1, -1);
      out.push(<a key={key++} href={url} target="_blank" rel="noreferrer" className="text-cyan underline decoration-cyan/40 hover:decoration-cyan">{label}</a>);
    }
    i = m.index + tok.length;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] | null = null;
  let numbers: string[] | null = null;
  let fenced: string[] | null = null;
  let fenceLang = '';
  let k = 0;
  const flush = () => {
    if (bullets) {
      blocks.push(<ul key={k++} className="list-disc list-outside pl-5 space-y-0.5">{bullets.map((b, i) => <li key={i}>{renderInline(b)}</li>)}</ul>);
      bullets = null;
    }
    if (numbers) {
      blocks.push(<ol key={k++} className="list-decimal list-outside pl-5 space-y-0.5">{numbers.map((b, i) => <li key={i}>{renderInline(b)}</li>)}</ol>);
      numbers = null;
    }
  };
  for (const raw of lines) {
    const ln = raw.trimEnd();
    /* Fenced code blocks ```lang ... ``` */
    const fm = ln.match(/^```(\w*)\s*$/);
    if (fm) {
      if (fenced) {
        blocks.push(
          <pre key={k++} className="my-1.5 px-3 py-2 rounded border border-cyan/30 bg-ink2/60 overflow-x-auto">
            {fenceLang && <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-cyan/70 mb-1">{fenceLang}</div>}
            <code className="font-mono text-[12px] text-bone whitespace-pre">{fenced.join('\n')}</code>
          </pre>
        );
        fenced = null; fenceLang = '';
      } else {
        flush();
        fenced = []; fenceLang = fm[1] || '';
      }
      continue;
    }
    if (fenced) { fenced.push(raw); continue; }

    const bm = ln.match(/^\s*[-*]\s+(.+)$/);
    const nm = ln.match(/^\s*\d+\.\s+(.+)$/);
    if (bm) {
      if (numbers) flush();
      bullets ??= [];
      bullets.push(bm[1]);
    } else if (nm) {
      if (bullets) flush();
      numbers ??= [];
      numbers.push(nm[1]);
    } else if (ln.trim() === '') {
      flush();
      blocks.push(<div key={k++} className="h-2" />);
    } else {
      flush();
      blocks.push(<div key={k++}>{renderInline(ln)}</div>);
    }
  }
  flush();
  return <div className="leading-relaxed">{blocks}</div>;
}

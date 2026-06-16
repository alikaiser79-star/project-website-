import { useEffect, useRef } from 'react';

export default function Background() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef  = useRef<HTMLDivElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);
  const glowRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = window.innerWidth/2, y = window.innerHeight/2;
    let tx = x, ty = y;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.left = tx + 'px';
        cursorRef.current.style.top  = ty + 'px';
      }
    };
    const onDown = () => cursorRef.current?.classList.add('active');
    const onUp   = () => cursorRef.current?.classList.remove('active');

    const tick = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      if (trailRef.current) {
        trailRef.current.style.left = x + 'px';
        trailRef.current.style.top  = y + 'px';
      }
      // Mouse-reactive grid: nudge by a few px proportional to mouse offset
      if (gridRef.current) {
        const nx = (x / window.innerWidth - 0.5) * 14;
        const ny = (y / window.innerHeight - 0.5) * 14;
        gridRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
      }
      if (glowRef.current) {
        glowRef.current.style.background =
          `radial-gradient(420px 320px at ${x}px ${y}px, rgba(255,179,0,0.10), transparent 70%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <>
      {/* Drifting grid — mouse-reactive parallax */}
      <div
        ref={gridRef}
        aria-hidden
        className="fixed inset-0 z-0 bg-grid animate-grid-drift will-change-transform"
        style={{ backgroundSize: '40px 40px', transition: 'transform 120ms linear' }}
      />
      {/* Cursor-tracked radial highlight */}
      <div ref={glowRef} aria-hidden className="fixed inset-0 z-0 pointer-events-none" />
      {/* Radial vignette glow */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 600px at 50% 35%, rgba(255,179,0,0.10), transparent 60%),' +
            'radial-gradient(700px 500px at 85% 80%, rgba(95,227,255,0.05), transparent 60%)',
        }}
      />
      <div className="scanlines" />
      <div className="vignette" />
      <div className="scan-sweep animate-scan" />
      <div ref={cursorRef} className="kai-cursor hidden md:block" />
      <div ref={trailRef}  className="kai-trail  hidden md:block" />
    </>
  );
}

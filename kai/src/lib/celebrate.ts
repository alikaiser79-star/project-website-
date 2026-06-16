/* Lightweight confetti burst — small canvas, 800ms life. No deps. */

const COLORS = ['#FFB300', '#FFC94A', '#5FE3FF', '#7AE6A8'];

export function celebrate(originX?: number, originY?: number) {
  const ox = originX ?? innerWidth / 2;
  const oy = originY ?? innerHeight / 3;
  const cv = document.createElement('canvas');
  cv.width = innerWidth; cv.height = innerHeight;
  Object.assign(cv.style, {
    position: 'fixed', inset: '0', zIndex: '999', pointerEvents: 'none',
  } as CSSStyleDeclaration);
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;

  const N = 90;
  const parts = Array.from({ length: N }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 6 + Math.random() * 10;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      size: 4 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 0,
    };
  });

  let raf = 0;
  const start = performance.now();
  function frame(now: number) {
    const t = now - start;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.vy += 0.45;            // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life += 16;
      const alpha = Math.max(0, 1 - t / 1400);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (t < 1500) raf = requestAnimationFrame(frame);
    else { cancelAnimationFrame(raf); cv.remove(); }
  }
  raf = requestAnimationFrame(frame);
}

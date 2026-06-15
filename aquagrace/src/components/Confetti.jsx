import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUI } from "../context/UIContext.jsx";

const COLORS = ["#f9a8d4", "#ff8a95", "#fde68a", "#c4b5fd", "#5ee0f0", "#fff"];
const SHAPES = ["✦", "★", "✿", "❤", "●"];

// Generate one burst of confetti pieces with deterministic-feeling randomness.
function makeBurst(seed = 0) {
  return Array.from({ length: 70 }).map((_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 220 + Math.random() * 320;
    return {
      id: `${seed}-${i}`,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 60,
      rotate: -180 + Math.random() * 360,
      delay: Math.random() * 0.15,
      duration: 1.2 + Math.random() * 1.4,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      size: 12 + Math.random() * 18,
    };
  });
}

export default function Confetti() {
  const { confettiBurst } = useUI();
  const [active, setActive] = useState(false);
  const pieces = useMemo(() => makeBurst(confettiBurst), [confettiBurst]);

  useEffect(() => {
    if (!confettiBurst) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 2800);
    return () => clearTimeout(t);
  }, [confettiBurst]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {active && (
          <div
            key={confettiBurst}
            className="absolute left-1/2 top-1/2 h-0 w-0"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            {pieces.map((p) => (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  opacity: [0, 1, 1, 0],
                  scale: [0.4, 1, 1, 0.8],
                  rotate: p.rotate,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeOut",
                  times: [0, 0.2, 0.7, 1],
                }}
                className="absolute"
                style={{
                  color: p.color,
                  fontSize: p.size,
                  textShadow: `0 0 12px ${p.color}aa`,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {p.shape}
              </motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

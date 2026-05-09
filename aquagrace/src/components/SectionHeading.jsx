import { motion } from "framer-motion";

export default function SectionHeading({ eyebrow, title, subtitle, align = "center", light = false }) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`max-w-3xl ${alignClass}`}
    >
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className={`mt-3 font-display text-4xl md:text-5xl font-semibold leading-[1.05] ${light ? "text-navy" : "text-white"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-base md:text-lg ${light ? "text-navy/70" : "text-white/65"}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

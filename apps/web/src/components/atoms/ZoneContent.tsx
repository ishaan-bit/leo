'use client';

/**
 * ZoneContent - Typography layer for landing zones
 * Matches the dreamy, poetic style of interlude and reflect pages
 * - Region name: serif (Cormorant Garamond style)
 * - Oil label: sans light
 * - Caption: whisper-like, minimal
 */

import { motion } from 'framer-motion';

interface ZoneContentProps {
  regionName: string;
  oilLabel: string;
  caption: string;
  opacity: number;
  isExpanded?: boolean;
}

export default function ZoneContent({
  regionName,
  oilLabel,
  caption,
  opacity,
  isExpanded = false,
}: ZoneContentProps) {
  return (
    <motion.div
      className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center"
      style={{ opacity }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity, y: 0 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      {/* Region name - serif, large, breathing */}
      <motion.h2
        className="font-serif text-4xl md:text-5xl lg:text-6xl font-light tracking-wide text-white drop-shadow-lg"
        style={{
          textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          lineHeight: 1.3,
        }}
        animate={{
          opacity: [0.9, 1, 0.9],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {regionName}
      </motion.h2>

      {/* Oil label - sans light, subtle */}
      <motion.p
        className="mt-4 font-sans text-sm md:text-base font-light tracking-widest uppercase text-white/80"
        style={{
          letterSpacing: '0.15em',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        {oilLabel}
      </motion.p>

      {/* Caption - poetic whisper */}
      {caption && (
        <motion.p
          className="mt-8 max-w-md font-sans text-base md:text-lg font-light leading-relaxed text-white/90"
          style={{
            textShadow: '0 1px 10px rgba(0,0,0,0.2)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.9, y: 0 }}
          transition={{ delay: 1, duration: 1.5 }}
        >
          {caption}
        </motion.p>
      )}

      {/* Subtle glow beneath text */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 60%)',
          filter: 'blur(30px)',
        }}
      />
    </motion.div>
  );
}

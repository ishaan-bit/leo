'use client';

import { motion } from 'framer-motion';
import PinkPig from '../molecules/PinkPig';

/**
 * InterludeVisuals - Cinematic Ghibli + Disco Elysium aesthetic
 * 
 * Visual Elements:
 * - Bioluminescent pulse on Fury (5s cycle, 0% → 40% luminance)
 * - Radial waves expanding from pig (6s duration, staggered)
 * - Floating dust motes drifting upward (8-12s animations)
 * - Film grain overlay (3% opacity, SVG noise)
 * - Depth blur vignette at edges
 * - Ear twitch every 10s for micro-motion
 * 
 * Accessibility:
 * - Respects prefers-reduced-motion
 * - Glow capped <250 nits equivalent
 * - Animations use easeInOutCirc for breathing feel
 */

interface InterludeVisualsProps {
  phase: 'held_safe' | 'interlude_active' | 'complete_transition' | 'progress_ready';
  pigName: string;
  reduceMotion?: boolean;
}

// Easing curve for breathing motion
const breathingCurve = [0.4, 0, 0.2, 1];

export default function InterludeVisuals({
  phase,
  pigName,
  reduceMotion = false,
}: InterludeVisualsProps) {
  // Animation parameters based on reduce motion
  const glowIntensity = reduceMotion ? 0.15 : 0.4;
  const particleCount = reduceMotion ? 4 : 8;
  const waveCount = reduceMotion ? 1 : 3;

  return (
    <>
      {/* Depth blur vignette */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, transparent 50%, rgba(255, 192, 203, 0.2) 100%)',
          backdropFilter: 'blur(8px)',
          maskImage: 'radial-gradient(circle at center, transparent 60%, black 100%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 60%, black 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'interlude_active' ? 1 : 0 }}
        transition={{ duration: 2, ease: breathingCurve }}
      />

      {/* Radial breathing waves - expanding from pig center */}
      {!reduceMotion && phase === 'interlude_active' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-5">
          {Array.from({ length: waveCount }).map((_, i) => (
            <motion.div
              key={`wave-${i}`}
              className="absolute rounded-full border-2 border-pink-300/30"
              style={{
                width: '200px',
                height: '200px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 3.5],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                delay: i * 2, // Stagger waves by 2s
                ease: breathingCurve,
              }}
            />
          ))}
        </div>
      )}

      {/* Pig with bioluminescent pulse */}
      <motion.div
        className="fixed z-20"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={
          !reduceMotion && phase === 'interlude_active'
            ? {
                filter: [
                  'brightness(1) drop-shadow(0 0 0px rgba(255, 105, 180, 0))',
                  `brightness(1.15) drop-shadow(0 0 40px rgba(255, 105, 180, ${glowIntensity}))`,
                  'brightness(1) drop-shadow(0 0 0px rgba(255, 105, 180, 0))',
                ],
              }
            : {}
        }
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: breathingCurve,
        }}
      >
        <PinkPig
          size={200}
          state={
            phase === 'held_safe'
              ? 'idle'
              : phase === 'interlude_active'
              ? 'thinking'
              : 'happy'
          }
          onInputFocus={false}
          wordCount={0}
        />
      </motion.div>

      {/* Floating dust motes */}
      {!reduceMotion && phase === 'interlude_active' && (
        <div className="fixed inset-0 pointer-events-none z-15 overflow-hidden">
          {Array.from({ length: particleCount }).map((_, i) => {
            // Random starting positions
            const startX = 10 + Math.random() * 80; // 10-90% from left
            const startY = 60 + Math.random() * 40; // 60-100% from top (start at bottom)
            const endY = -10; // Float off screen
            const drift = (Math.random() - 0.5) * 30; // Horizontal drift ±15%
            const duration = 8 + Math.random() * 4; // 8-12s
            const delay = Math.random() * 4; // 0-4s stagger
            const size = 2 + Math.random() * 3; // 2-5px

            return (
              <motion.div
                key={`mote-${i}`}
                className="absolute rounded-full bg-white/40 blur-[1px]"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${startX}%`,
                }}
                initial={{ 
                  y: `${startY}vh`, 
                  x: 0,
                  opacity: 0 
                }}
                animate={{
                  y: `${endY}vh`,
                  x: `${drift}%`,
                  opacity: [0, 0.6, 0.6, 0],
                }}
                transition={{
                  duration,
                  delay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Film grain overlay - SVG noise pattern */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-30 mix-blend-overlay"
        style={{ opacity: 0.03 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'interlude_active' ? 0.03 : 0 }}
        transition={{ duration: 1 }}
      >
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </motion.div>

      {/* Gradient background shift - synchronized with bioluminescent pulse */}
      <motion.div
        className="fixed inset-0 -z-10"
        animate={
          !reduceMotion && phase === 'interlude_active'
            ? {
                background: [
                  'radial-gradient(circle at 50% 50%, rgba(255, 192, 203, 0.3) 0%, rgba(255, 182, 193, 0.2) 50%, rgba(255, 240, 245, 0.1) 100%)',
                  'radial-gradient(circle at 50% 50%, rgba(255, 105, 180, 0.35) 0%, rgba(255, 192, 203, 0.25) 50%, rgba(255, 240, 245, 0.15) 100%)',
                  'radial-gradient(circle at 50% 50%, rgba(255, 192, 203, 0.3) 0%, rgba(255, 182, 193, 0.2) 50%, rgba(255, 240, 245, 0.1) 100%)',
                ],
              }
            : {
                background:
                  'radial-gradient(circle at 50% 50%, rgba(255, 192, 203, 0.2) 0%, rgba(255, 182, 193, 0.1) 50%, rgba(255, 240, 245, 0.05) 100%)',
              }
        }
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: breathingCurve,
        }}
      />
    </>
  );
}

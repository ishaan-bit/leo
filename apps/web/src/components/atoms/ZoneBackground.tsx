'use client';

/**
 * ZoneBackground - Atmospheric gradient with breathing animation
 * Features:
 * - Radial gradients with procedural drift (20s ease-in-out)
 * - Ambient element overlay (emotion-specific particles)
 * - Pulse-driven opacity, scale, and hue modulation
 * - Depth fog and blur effects
 */

import { motion } from 'framer-motion';
import { AMBIENT_ELEMENTS } from './AmbientElements';
import type { EmotionKey, Palette } from '@/content/regions';

interface ZoneBackgroundProps {
  emotion: EmotionKey;
  palette: Palette;
  arousal: number;
  valence: number;
  pulseStrength: number;
  hueShift: number;
  scale: number;
  opacity: number;
}

export default function ZoneBackground({
  emotion,
  palette,
  arousal,
  valence,
  pulseStrength,
  hueShift,
  scale,
  opacity,
}: ZoneBackgroundProps) {
  const AmbientElement = AMBIENT_ELEMENTS[emotion];

  // Gradient speed modulated by arousal
  const driftDuration = 20 - (arousal * 8); // 12s-20s range

  // Warmth affects color intensity
  const warmth = 0.5 + (valence * 0.5);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          filter: `blur(40px) hue-rotate(${hueShift}deg)`,
          opacity,
          scale,
        }}
        animate={{
          background: [
            `radial-gradient(ellipse at 30% 40%, ${palette.bg} 0%, ${palette.fg}40 50%, ${palette.accent}20 100%)`,
            `radial-gradient(ellipse at 70% 60%, ${palette.fg}40 0%, ${palette.bg} 50%, ${palette.glow}30 100%)`,
            `radial-gradient(ellipse at 30% 40%, ${palette.bg} 0%, ${palette.fg}40 50%, ${palette.accent}20 100%)`,
          ],
        }}
        transition={{
          duration: driftDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Secondary gradient layer for depth */}
      <motion.div
        className="absolute inset-0"
        style={{
          filter: `blur(60px) hue-rotate(${hueShift * 0.5}deg)`,
          opacity: opacity * 0.6,
        }}
        animate={{
          background: [
            `radial-gradient(circle at 50% 50%, ${palette.glow}30 0%, transparent 70%)`,
            `radial-gradient(circle at 40% 60%, ${palette.accent}20 0%, transparent 70%)`,
            `radial-gradient(circle at 60% 40%, ${palette.glow}30 0%, transparent 70%)`,
            `radial-gradient(circle at 50% 50%, ${palette.glow}30 0%, transparent 70%)`,
          ],
        }}
        transition={{
          duration: driftDuration * 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ambient element overlay */}
      <AmbientElement opacity={opacity * 0.8} pulseStrength={pulseStrength} />

      {/* Depth fog vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, ${0.1 * (1 - warmth)}) 100%)`,
        }}
      />

      {/* Subtle grain texture */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
          opacity: 0.02 + (arousal * 0.03),
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

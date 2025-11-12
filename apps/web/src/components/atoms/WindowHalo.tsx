/**
 * WindowHalo - Radial rounded halo effect for glowing windows
 * 
 * Replaces rectangular glow with a clean radial halo.
 * Optional pulse effect (slow 3-5s breathing).
 * Feature flag to disable if rendering artifacts appear.
 * 
 * Features:
 * - Radial gradient (no hard rectangles)
 * - Light feathering
 * - Optional slow pulse (3-5s)
 * - GPU-accelerated (opacity + scale transforms)
 * - Respects prefers-reduced-motion
 */

'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface WindowHaloProps {
  /** Window color */
  color: string;
  
  /** Enable pulse animation */
  pulse?: boolean;
  
  /** Halo size multiplier (1.0 = window size) */
  size?: number;
  
  /** Halo intensity (0-1) */
  intensity?: number;
  
  /** Enable/disable feature */
  enabled?: boolean;
}

// Feature flags
const UI_ENABLE_WINDOW_HALO = true;

export default function WindowHalo({
  color,
  pulse = true,
  size = 2.5,
  intensity = 0.5,
  enabled = UI_ENABLE_WINDOW_HALO,
}: WindowHaloProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduce motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (!enabled) return null;

  const shouldPulse = pulse && !prefersReducedMotion;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none -z-10"
      style={{
        transform: `scale(${size})`,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        filter: 'blur(8px)',
      }}
      animate={shouldPulse ? {
        opacity: [intensity * 0.8, intensity, intensity * 0.8],
        scale: [size * 0.95, size, size * 0.95],
      } : {}}
      transition={shouldPulse ? {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {}}
    />
  );
}

'use client';

/**
 * LandingZone - Atmospheric emotional landing zone with breathing rhythm
 * Combines background ambience + content typography with pulse-driven animations
 * 
 * Features:
 * - Breathing pulse synchronized to arousal/valence
 * - Hover interactions (brightens + amplifies motion)
 * - Mobile-first fullscreen layout
 * - Smooth transitions between states
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePulse } from '@/hooks/usePulse';
import ZoneBackground from '@/components/atoms/ZoneBackground';
import ZoneContent from '@/components/atoms/ZoneContent';
import type { Zone } from '@/lib/landing-zone/rules';

interface LandingZoneProps {
  zone: Zone;
  phaseOffset?: number;
  isExpanded?: boolean;
  onTap?: () => void;
}

export default function LandingZone({
  zone,
  phaseOffset = 0,
  isExpanded = false,
  onTap,
}: LandingZoneProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get pulse-driven animation values
  const pulse = usePulse({
    arousal: zone.arousal,
    valence: zone.valence,
    phaseOffset,
  });

  // Hover amplifies effects
  const activeOpacity = isHovered ? Math.min(pulse.opacity * 1.1, 1) : pulse.opacity;
  const activeScale = isHovered ? pulse.scale * 1.02 : pulse.scale;
  const activePulseStrength = isHovered
    ? Math.min(pulse.pulseStrength * 1.2, 1)
    : pulse.pulseStrength;

  return (
    <motion.div
      className="relative overflow-hidden cursor-pointer"
      style={{
        height: isExpanded ? '100vh' : '50vh',
        width: '100%',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTap={onTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      whileTap={onTap ? { scale: 1.02 } : {}}
    >
      {/* Background with atmospheric elements */}
      <ZoneBackground
        emotion={zone.emotion}
        palette={zone.palette}
        arousal={zone.arousal}
        valence={zone.valence}
        pulseStrength={activePulseStrength}
        hueShift={pulse.hueShift}
        scale={activeScale}
        opacity={activeOpacity}
      />

      {/* Content typography layer */}
      <ZoneContent
        regionName={zone.regionName}
        oilLabel={zone.oilLabel}
        caption={zone.caption}
        opacity={activeOpacity}
        isExpanded={isExpanded}
      />

      {/* Hover glow overlay */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${zone.palette.glow}20 0%, transparent 60%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
}

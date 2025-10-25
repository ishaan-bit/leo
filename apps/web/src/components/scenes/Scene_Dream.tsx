/**
 * Dream Scene - Ghibli-style City of Living Moments
 * Layered city with parallax, building glows, and cinematic beats
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { PendingDream, DreamBeat, BuildingName } from '@/domain/dream/dream.types';
import { BUILDINGS } from '@/domain/dream/dream.config';
import { createSeededRandom, DreamSeeds } from '@/domain/dream/seeded-random';
import DreamTextCard from '@/components/molecules/DreamTextCard';

interface DreamSceneProps {
  dream: PendingDream;
  currentTime: number;
  isPaused: boolean;
}

const EASING = [0.4, 0, 0.2, 1]; // sine-in-out

export function DreamScene({ dream, currentTime, isPaused }: DreamSceneProps) {
  const [currentBeat, setCurrentBeat] = useState<DreamBeat | null>(null);
  const [activeBuilding, setActiveBuilding] = useState<BuildingName | null>(null);
  const [showLine, setShowLine] = useState(false);
  const [lineText, setLineText] = useState('');
  
  const cameraZoom = useMotionValue(1);
  const cameraY = useMotionValue(0);
  
  const prefersReducedMotion = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
  }, []);

  // Track current beat based on time
  useEffect(() => {
    if (!dream || isPaused) return;

    // Find current beat
    let beat: DreamBeat | null = null;
    for (let i = dream.beats.length - 1; i >= 0; i--) {
      if (currentTime >= dream.beats[i].t) {
        beat = dream.beats[i];
        break;
      }
    }

    if (beat?.kind !== currentBeat?.kind || beat?.momentId !== currentBeat?.momentId) {
      setCurrentBeat(beat);
      handleBeatChange(beat);
    }
  }, [currentTime, dream, isPaused]);

  const handleBeatChange = (beat: DreamBeat | null) => {
    if (!beat) return;

    switch (beat.kind) {
      case 'takeoff':
        // Micro-zoom to 1.05 then settle to 1.00
        cameraZoom.set(1.05);
        setTimeout(() => cameraZoom.set(1.00), 1500);
        cameraY.set(10);
        setTimeout(() => cameraY.set(0), 2000);
        
        // Show opening line
        setLineText(dream.opening);
        setShowLine(true);
        setTimeout(() => setShowLine(false), 4000);
        break;

      case 'drift':
        // Ambient breathing
        setActiveBuilding(null);
        break;

      case 'moment':
        if (beat.building && beat.line) {
          setActiveBuilding(beat.building);
          setLineText(beat.line);
          setShowLine(true);
          
          // Hide line after slot duration - fade time
          const timeline = dream.beats;
          const beatIndex = timeline.findIndex(b => b === beat);
          const nextBeat = timeline[beatIndex + 1];
          const holdTime = nextBeat ? (nextBeat.t - beat.t) * 1000 - 800 : 2000;
          
          setTimeout(() => setShowLine(false), holdTime);
        }
        break;

      case 'resolve':
        // Center on focus building
        if (beat.focus) {
          setActiveBuilding(beat.focus);
        }
        setShowLine(false);
        break;
    }
  };

  // Parallax transform values
  const skylineX = useTransform(cameraY, [0, 10], [0, 3]);
  const skylineY = useTransform(cameraY, [0, 10], [0, 1]);
  const buildingsX = useTransform(cameraY, [0, 10], [0, -2]);

  // Film grain overlay
  const filmGrainOpacity = 0.07;

  // Reduced motion fallback: 3s postcard
  if (prefersReducedMotion.current) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${BUILDINGS[dream.palette.primary].colors.base}, ${BUILDINGS[dream.palette.primary].colors.accent})`,
        }}
      >
        <div className="max-w-2xl px-6 text-center">
          <motion.h1
            className="text-3xl mb-6"
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              color: 'rgba(0,0,0,0.85)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {dream.opening}
          </motion.h1>
          <motion.p
            className="text-lg"
            style={{
              fontFamily: '"Inter", sans-serif',
              color: 'rgba(0,0,0,0.7)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            {dream.beats.filter(b => b.kind === 'moment').length} moments remembered
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#E8D5F0] via-[#D8C6E5] to-[#BBA3D4]">
      {/* Skyline layer (far) */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          x: skylineX,
          y: skylineY,
          scale: cameraZoom,
        }}
      >
        <SkylineLayer />
      </motion.div>

      {/* Buildings layer (mid) */}
      <motion.div
        className="absolute inset-0 z-10"
        style={{
          x: buildingsX,
          scale: cameraZoom,
        }}
      >
        <BuildingsLayer 
          activeBuilding={activeBuilding}
          dream={dream}
          currentTime={currentTime}
        />
      </motion.div>

      {/* Windows plane (near) */}
      <motion.div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ scale: cameraZoom }}
      >
        <WindowsLayer 
          activeBuilding={activeBuilding}
          dream={dream}
        />
      </motion.div>

      {/* Film grain overlay */}
      <div 
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.07\'/%3E%3C/svg%3E")',
          opacity: filmGrainOpacity,
        }}
      />

      {/* Text card overlay */}
      <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {showLine && (
            <DreamTextCard
              key={lineText}
              text={lineText}
              primaryColor={BUILDINGS[dream.palette.primary].colors.base}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {showLine && lineText}
      </div>
    </div>
  );
}

/**
 * Skyline layer - watercolor distant buildings
 */
function SkylineLayer() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-40">
      <svg viewBox="0 0 1200 400" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="skylineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6B7C8E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8AA1B3" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          d="M0,350 L100,320 L180,340 L250,310 L320,330 L400,300 L480,320 L560,290 L640,310 L720,280 L800,300 L880,270 L960,290 L1040,260 L1120,280 L1200,250 L1200,400 L0,400 Z"
          fill="url(#skylineGrad)"
        />
      </svg>
    </div>
  );
}

/**
 * Buildings layer - six zones mapped to primaries
 */
function BuildingsLayer({ 
  activeBuilding, 
  dream,
  currentTime 
}: { 
  activeBuilding: BuildingName | null;
  dream: PendingDream;
  currentTime: number;
}) {
  const buildings: BuildingName[] = ['Haven', 'Vera', 'Lumen', 'Aster', 'Ember', 'Crown'];
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-around px-8">
      {buildings.map((building, i) => (
        <Building
          key={building}
          name={building}
          isActive={activeBuilding === building}
          dream={dream}
          currentTime={currentTime}
          index={i}
        />
      ))}
    </div>
  );
}

/**
 * Individual building with breath-pulse and glow
 */
function Building({ 
  name, 
  isActive,
  dream,
  currentTime,
  index 
}: { 
  name: BuildingName;
  isActive: boolean;
  dream: PendingDream;
  currentTime: number;
  index: number;
}) {
  const primary = Object.entries(BUILDINGS).find(([_, b]) => b.name === name)?.[0] as keyof typeof BUILDINGS;
  const config = BUILDINGS[primary];
  
  // Seeded hue drift (±3°)
  const hueSeed = DreamSeeds.glowHueDrift(dream.scriptId, `building_${index}`);
  const rng = createSeededRandom(hueSeed);
  const hueDrift = rng.nextFloat(-3, 3);
  
  const baseColor = config.colors.base;
  const glowColor = config.colors.glow;
  
  return (
    <motion.div
      className="relative"
      style={{
        width: `${12 + index % 3}%`,
        height: `${60 + (index % 4) * 10}%`,
        filter: `hue-rotate(${hueDrift}deg)`,
      }}
      animate={isActive ? {
        scale: [1.00, 1.04, 1.00],
      } : {
        scale: 1.00,
      }}
      transition={{
        duration: isActive ? 2.5 : 0.5,
        ease: EASING,
        repeat: isActive ? Infinity : 0,
      }}
    >
      {/* Building facade */}
      <div
        className="absolute inset-0 rounded-t-lg"
        style={{
          background: `linear-gradient(180deg, ${baseColor} 0%, ${config.colors.accent} 100%)`,
          boxShadow: isActive 
            ? `0 0 60px ${glowColor}, 0 0 120px ${glowColor}80`
            : `0 10px 40px rgba(0,0,0,0.2)`,
          transition: 'box-shadow 1s ease-in-out',
        }}
      />
    </motion.div>
  );
}

/**
 * Windows plane - glowing windows with breathing effect
 */
function WindowsLayer({ 
  activeBuilding,
  dream 
}: { 
  activeBuilding: BuildingName | null;
  dream: PendingDream;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-around px-8">
      {['Haven', 'Vera', 'Lumen', 'Aster', 'Ember', 'Crown'].map((building, i) => (
        <div
          key={building}
          className="relative"
          style={{
            width: `${12 + i % 3}%`,
            height: `${60 + (i % 4) * 10}%`,
          }}
        >
          <motion.div
            className="absolute inset-4 grid grid-cols-3 gap-2"
            animate={{
              opacity: activeBuilding === building ? [0.85, 1, 0.85] : [0.7, 0.85, 0.7],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {Array.from({ length: 9 }).map((_, j) => (
              <div
                key={j}
                className="rounded-sm"
                style={{
                  backgroundColor: activeBuilding === building ? '#FFF5E6' : '#F4E6C3',
                  boxShadow: activeBuilding === building 
                    ? '0 0 8px rgba(255,245,230,0.8)'
                    : '0 0 4px rgba(244,230,195,0.5)',
                }}
              />
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export default DreamScene;

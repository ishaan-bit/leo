'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import AuthStateIndicator from '../atoms/AuthStateIndicator';
import SoundToggle from '../atoms/SoundToggle';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { getZone, type PrimaryEmotion } from '@/lib/zones';

/**
 * CityInterlude - "THE CITY BEFORE THE SIGNAL"
 * 
 * 🜂 Total time: ≈42s ambient loop until Stage 1 completes
 * Environment: Night forming over Leo's emotional city (6 towers)
 * Goal: Hold user attention quietly; end on pulsing towers ready for result-driven zoom
 * 
 * Timeline:
 * Phase 1 – The Holding (0-14s)
 *   Beat 1 (0-5s): "Your moment has been held safe" - Leo breathing, warm blush bg
 *   Beat 2 (5-14s): Transition to mauve, ripples, dust motes rising, stars appear
 * 
 * Phase 2 – The Breath Between Things (14-26s)
 *   Beat 3 (14-20s): "A quiet breath between things" - Leo inhales/exhales, particles drift
 *   Beat 4 (20-26s): Leo ascends, motes pause (gravity pause), held breath
 * 
 * Phase 3 – Time Holding Its Breath (26-34s)
 *   Beat 5 (26-32s): "And time holding its breath" - Twilight gradient, Leo rises to upper-third
 * 
 * Phase 4 – The Pulse of the City (34-42s → loop)
 *   Beat 6 (34-37s): Six towers slide up (Vera, Vanta, Haven, Ashmere, Vire, Sable)
 *   Beat 7 (37-40s): City breathes - windows pulse in sync (4s sine wave)
 *   Beat 8 (40s+): Suspended breath / ready state - loop until backend emits Stage 1
 * 
 * When Stage 1 arrives: One tower (primary emotion zone) stays bright → hand-off to next scene
 */

interface CityInterludeProps {
  reflectionId: string;
  pigName: string;
  onComplete: (primaryEmotion: string) => void;
  onTimeout?: () => void;
}

// Emotional towers mapped to Willcox primaries
// MAPPING: joyful→Vera, powerful→Ashmere, peaceful→Haven, sad→Vanta, scared→Vire, mad→Sable
const TOWERS = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 180 },      // Joyful - gold
  { id: 'powerful', name: 'Ashmere', color: '#FF6B35', x: 25, height: 220 }, // Powerful - orange
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 40, height: 160 },   // Peaceful - blue
  { id: 'sad', name: 'Vanta', color: '#7D8597', x: 55, height: 200 },        // Sad - gray
  { id: 'scared', name: 'Vire', color: '#5A189A', x: 70, height: 190 },      // Scared - purple
  { id: 'mad', name: 'Sable', color: '#C1121F', x: 85, height: 170 },        // Mad - red
];

const COPY = {
  phase1: 'Your moment has been held safe.',
  phase2: 'A quiet breath between things.',
  phase3: 'And time holding its breath.',
  phase4a: 'While the city stirs below.',
  phase4b: 'Each tower a feeling waiting.',
  phase4c: 'To be named.',
};

// Enhanced timing for Ghibli-style atmospheric transitions (compressed by ~10s total)
const TIMING = {
  PHASE1_DURATION: 5000,    // 0-5s (was 14s)
  PHASE2_DURATION: 5000,    // 5-10s (was 12s)
  PHASE3_START: 10000,      // Phase 3 begins at 10s (was 26s)
  PHASE3_HOLD: 5000,        // 10-15s - text fade + horizon reveal (was 10s)
  STARS_TWINKLE: 5000,      // 15-20s - stars + clouds + Leo glow (was 10s)
  SKYLINE_EMERGE: 4000,     // 20-24s - first silhouettes (was 10s)
  TOWERS_RISE: 6000,        // 24-30s - towers + windows + parallax (was 10s)
  PHASE4_START: 30000,      // Phase 4 ready state (was 42s)
};

export default function CityInterlude({
  reflectionId,
  pigName,
  onComplete,
  onTimeout,
}: CityInterludeProps) {
  const { data: session, status } = useSession();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3 | 4 | 5>(1); // Added phase 5 for zoom
  const [currentBeat, setCurrentBeat] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [showCopy, setShowCopy] = useState<string | null>(null);
  const [phase4CycleIndex, setPhase4CycleIndex] = useState(0); // For cycling phase 4 text
  const [cityPulseActive, setCityPulseActive] = useState(false);
  const [primaryEmotion, setPrimaryEmotion] = useState<string | null>(null);
  const [primaryLocked, setPrimaryLocked] = useState(false);
  const [zoomStartTime, setZoomStartTime] = useState<number | null>(null);
  const [skylineVisible, setSkylineVisible] = useState(false);
  const [towersRising, setTowersRising] = useState(false);
  const [phase3SubBeat, setPhase3SubBeat] = useState<'hold' | 'stars' | 'emerge' | 'rise' | 'ready'>('hold');
  
  const startTimeRef = useRef(Date.now());
  const cityPulseRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  
  // Check for accessibility preferences
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Poll enrichment status
  const { isReady, error, reflection } = useEnrichmentStatus(reflectionId, {
    enabled: true,
    pollInterval: 3500,
    onTimeout: () => {
      if (onTimeout) onTimeout();
    },
  });

  // Master timeline - update elapsed time every 16ms (~60fps) for fluid animations
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(elapsed);
      
      // Phase 3 sub-beats for cinematic Ghibli-style transition (compressed timing)
      if (currentPhase === 3) {
        const phase3Start = TIMING.PHASE3_START; // 10s
        const phase3Elapsed = elapsed - phase3Start;
        
        if (phase3Elapsed >= TIMING.PHASE3_HOLD + TIMING.STARS_TWINKLE + TIMING.SKYLINE_EMERGE) {
          // 20s+ (was 24s+)
          setPhase3SubBeat('ready');
          setTowersRising(true);
        } else if (phase3Elapsed >= TIMING.PHASE3_HOLD + TIMING.STARS_TWINKLE) {
          // 10s-20s (was 20s-30s)
          setPhase3SubBeat('rise');
          setTowersRising(true);
        } else if (phase3Elapsed >= TIMING.PHASE3_HOLD) {
          // 5s-10s (was 10s-20s)
          setPhase3SubBeat('emerge');
          setSkylineVisible(true);
        } else if (phase3Elapsed >= 0) {
          // 0-5s (was 0-10s)
          setPhase3SubBeat('stars');
        }
      }
      
      // Phase transitions (compressed timeline)
      if (elapsed >= TIMING.PHASE4_START && currentPhase < 4) {
        // 30s (was 42s)
        setCurrentPhase(4);
        setCityPulseActive(true);
        setShowCopy(COPY.phase4a); // Start phase 4 cycling
      } else if (elapsed >= TIMING.PHASE3_START && currentPhase < 3) {
        // 10s (was 26s)
        setCurrentPhase(3);
        setShowCopy(COPY.phase3);
      } else if (elapsed >= TIMING.PHASE1_DURATION && currentPhase < 2) {
        // 5s (was 14s)
        setCurrentPhase(2);
        setShowCopy(COPY.phase2);
      } else if (elapsed >= 3000 && currentPhase === 1) {
        // Fade out phase 1 copy at 3s
        setShowCopy(null);
      }
      
      // Beat transitions (compressed timeline)
      if (elapsed >= 30000) setCurrentBeat(8);          // 30s+ (was 40s+)
      else if (elapsed >= 27000) setCurrentBeat(7);     // 27-30s (was 37-40s)
      else if (elapsed >= 24000) setCurrentBeat(6);     // 24-27s (was 34-37s)
      else if (elapsed >= 10000) setCurrentBeat(5);     // 10-24s (was 26-34s)
      else if (elapsed >= 7000) setCurrentBeat(4);      // 7-10s (was 20-26s)
      else if (elapsed >= 5000) setCurrentBeat(3);      // 5-7s (was 14-20s)
      else if (elapsed >= 3000) setCurrentBeat(2);      // 3-5s (was 5-14s)
      else setCurrentBeat(1);                           // 0-3s
    }, 16); // 60fps for smooth gradient breathing
    
    return () => clearInterval(interval);
  }, [currentPhase]);

  // Cycle through phase 4 poetic lines to prevent stuck appearance
  useEffect(() => {
    if (currentPhase !== 4) return;
    
    const phase4Lines = [COPY.phase4a, COPY.phase4b, COPY.phase4c];
    let cycleIndex = 0;
    
    const cycleInterval = setInterval(() => {
      cycleIndex = (cycleIndex + 1) % phase4Lines.length;
      setShowCopy(phase4Lines[cycleIndex]);
      setPhase4CycleIndex(cycleIndex);
    }, 4000); // Change every 4 seconds
    
    return () => clearInterval(cycleInterval);
  }, [currentPhase]);

  // Show initial copy
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCopy(COPY.phase1);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // City pulse animation loop (Phase 4)
  useEffect(() => {
    if (!cityPulseActive || prefersReducedMotion) return;
    
    const animate = () => {
      cityPulseRef.current += 0.016; // ~60fps
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cityPulseActive, prefersReducedMotion]);

  // Detect primary emotion from Stage-1 completion - ONLY REAL TRIGGER
  useEffect(() => {
    console.log('[CityInterlude] Detection check:', {
      hasFinal: !!reflection?.final,
      hasWheel: !!reflection?.final?.wheel,
      primary: reflection?.final?.wheel?.primary,
      primaryLocked,
      currentPhase,
    });
    
    if (!reflection?.final?.wheel?.primary) {
      console.log('[CityInterlude] ⚠️ No primary found, path check:', {
        reflection_exists: !!reflection,
        final_exists: !!reflection?.final,
        wheel_exists: !!reflection?.final?.wheel,
        primary_value: reflection?.final?.wheel?.primary
      });
      return;
    }
    
    const primary = reflection.final.wheel.primary.toLowerCase();
    const zone = getZone(primary);
    
    console.log('[CityInterlude] 🔍 Primary from backend:', primary, '→ Zone:', zone?.name || 'NOT FOUND');
    
    // Primary detected but waiting for phase 4 (pulsating buildings)
    if (zone && !primaryLocked && currentPhase < 4) {
      console.log('[CityInterlude] ⏳ Primary ready, waiting for phase 4 (pulsating buildings)...');
      setPrimaryEmotion(primary); // Store it
      return;
    }
    
    // Trigger transition when we hit phase 4 AND have primary
    if (zone && !primaryLocked && currentPhase === 4) {
      console.log(`[CityInterlude] 🎯✅ PHASE 4 + PRIMARY DETECTED → TRANSITION! ${primary} → ${zone.name}`);
      setPrimaryLocked(true);
      setPrimaryEmotion(primary); // Store primary for highlighting
      
      // Simple fade transition - no zoom
      setTimeout(() => {
        console.log('[CityInterlude] ✨ Showing zone name, fading other towers');
        setCurrentPhase(5); // Transition phase
        setZoomStartTime(Date.now());
        
        // Complete transition after 3s (time to show zone name and fade others)
        setTimeout(() => {
          const event = {
            type: 'stage1_transition_complete',
            payload: {
              sid: reflectionId,
              zone: zone.name,
              primary,
              interlude_version: 'v1',
              timestamp: new Date().toISOString(),
            },
          };
          
          console.log('[CityInterlude] 🎯 Transition complete, moving to breathing sequence');
          
          // Dispatch custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('stage1_transition_complete', { detail: event.payload }));
          }
          
          // Call onComplete callback
          onComplete(primary);
        }, 3000); // 3s transition
      }, 1000); // 1s stillness before transition
    }
  }, [reflection, primaryLocked, currentPhase, reflectionId, onComplete]);

  // Breathing, fluid background gradient - continuous like water flowing
  const getBackgroundGradient = () => {
    const elapsed = elapsedTime;
    
    // Helper to smoothly lerp between RGB values with easing
    const smoothLerp = (start: number, end: number, t: number) => {
      // Apply easeInOutSine for breathing effect
      const eased = -(Math.cos(Math.PI * t) - 1) / 2;
      return Math.round(start + (end - start) * eased);
    };
    
    // Helper to parse hex color
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };
    
    // Define color stops for continuous breathing flow
    const colorStops = [
      { time: 0, top: '#FCE9EF', bottom: '#F9D8E3' },           // 0s: Blush
      { time: TIMING.PHASE1_DURATION, top: '#F9D8E3', bottom: '#D7B3DB' },  // 5s: Petal pink → mauve
      { time: TIMING.PHASE3_START, top: '#C1A0E2', bottom: '#4A3568' },     // 10s: Violet
      { time: TIMING.PHASE3_START + 10000, top: '#3A2952', bottom: '#2B2357' }, // 20s: Deep violet
      { time: TIMING.PHASE4_START, top: '#0A0714', bottom: '#2B2357' },     // 30s: Night sky
    ];
    
    // Find which two color stops we're between
    let startStop = colorStops[0];
    let endStop = colorStops[1];
    
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (elapsed >= colorStops[i].time && elapsed < colorStops[i + 1].time) {
        startStop = colorStops[i];
        endStop = colorStops[i + 1];
        break;
      }
    }
    
    // If past all stops, use last one
    if (elapsed >= colorStops[colorStops.length - 1].time) {
      const last = colorStops[colorStops.length - 1];
      return `linear-gradient(180deg, ${last.top} 0%, ${last.bottom} 100%)`;
    }
    
    // Calculate progress between current stops
    const duration = endStop.time - startStop.time;
    const progress = (elapsed - startStop.time) / duration;
    
    // Interpolate top and bottom colors separately with smooth easing
    const startTopRgb = hexToRgb(startStop.top);
    const endTopRgb = hexToRgb(endStop.top);
    const startBottomRgb = hexToRgb(startStop.bottom);
    const endBottomRgb = hexToRgb(endStop.bottom);
    
    const topColor = `rgb(${smoothLerp(startTopRgb.r, endTopRgb.r, progress)}, ${smoothLerp(startTopRgb.g, endTopRgb.g, progress)}, ${smoothLerp(startTopRgb.b, endTopRgb.b, progress)})`;
    const bottomColor = `rgb(${smoothLerp(startBottomRgb.r, endBottomRgb.r, progress)}, ${smoothLerp(startBottomRgb.g, endBottomRgb.g, progress)}, ${smoothLerp(startBottomRgb.b, endBottomRgb.b, progress)})`;
    
    return `linear-gradient(180deg, ${topColor} 0%, ${bottomColor} 100%)`;
  };

  // Leo position and scale based on beat
  const getLeoTransform = () => {
    if (currentBeat <= 2) {
      return { y: 0, scale: 1 };
    } else if (currentBeat === 3) {
      return { y: -10, scale: 1.02 }; // Gentle inhale
    } else if (currentBeat === 4) {
      return { y: -30, scale: 1 }; // Begin ascent
    } else if (currentBeat >= 5) {
      return { y: -60, scale: 0.95 }; // Upper third
    }
    return { y: 0, scale: 1 };
  };

  // Compute city pulse brightness (sine wave, 4s period)
  const getCityPulseBrightness = () => {
    if (!cityPulseActive) return 0.2;
    const t = (Date.now() - startTimeRef.current - TIMING.PHASE4_START) / 4000; // 4s period
    return 0.2 + 0.4 * Math.sin(t * Math.PI * 2); // 0.2 → 0.6 → 0.2
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Sound Toggle - Persists through interlude */}
      <SoundToggle />
      
      {/* Auth State Indicator - Top center */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 md:pt-6 md:px-6">
        <div className="flex items-center gap-2 md:gap-4 backdrop-blur-sm bg-white/30 rounded-full px-3 py-1.5 md:px-4 md:py-2">
          <AuthStateIndicator 
            userName={session?.user?.name || session?.user?.email}
            isGuest={status === 'unauthenticated'}
          />
        </div>
      </div>

      {/* Breathing fluid background - updates at 60fps like water flowing */}
      <div
        className="absolute inset-0 -z-10 transition-colors duration-300 ease-linear"
        style={{
          background: getBackgroundGradient(),
        }}
      />

      {/* Moonlight glow (Phase 3+) */}
      {currentPhase >= 3 && (
        <motion.div
          className="absolute top-10 right-20 w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase3SubBeat === 'stars' ? 0.4 : 0.6 }}
          transition={{ duration: 5, ease: 'easeInOut' }}
        />
      )}

      {/* Stars - Enhanced with parallax layers (Phase 2+ but brighten in Phase 3) */}
      {currentBeat >= 2 && !prefersReducedMotion && (
        <>
          {/* Star layer 1 - Slowest, faintest */}
          <div className="absolute inset-0 z-5">
            {Array.from({ length: 20 }).map((_, i) => {
              const x = Math.random() * 100;
              const y = Math.random() * 60;
              const size = 1 + Math.random();
              const baseOpacity = currentPhase >= 3 ? 0.15 + Math.random() * 0.25 : 0.05;
              const delay = Math.random() * 3;
              
              return (
                <motion.div
                  key={`star-bg-${i}`}
                  className="absolute rounded-full bg-white"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [baseOpacity * 0.3, baseOpacity * 0.8, baseOpacity * 0.3],
                    y: [0, -10, 0], // Slow parallax drift
                  }}
                  transition={{
                    opacity: { duration: 4, delay, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 30, repeat: Infinity, ease: 'linear' },
                  }}
                />
              );
            })}
          </div>

          {/* Star layer 2 - Medium speed, brighter */}
          <div className="absolute inset-0 z-6">
            {Array.from({ length: 25 }).map((_, i) => {
              const x = Math.random() * 100;
              const y = Math.random() * 65;
              const size = 1.5 + Math.random() * 1.5;
              const baseOpacity = currentPhase >= 3 ? 0.25 + Math.random() * 0.35 : 0.08;
              const delay = Math.random() * 2;
              
              return (
                <motion.div
                  key={`star-mid-${i}`}
                  className="absolute rounded-full bg-white"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [baseOpacity * 0.5, baseOpacity, baseOpacity * 0.5],
                    y: [0, -5, 0],
                  }}
                  transition={{
                    opacity: { duration: 3, delay, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 20, repeat: Infinity, ease: 'linear' },
                  }}
                />
              );
            })}
          </div>

          {/* Star layer 3 - Foreground, brightest */}
          <div className="absolute inset-0 z-7">
            {Array.from({ length: 15 }).map((_, i) => {
              const x = Math.random() * 100;
              const y = Math.random() * 70;
              const size = 2 + Math.random() * 1.5;
              const baseOpacity = currentPhase >= 3 ? 0.4 + Math.random() * 0.4 : 0.1;
              const delay = Math.random();
              
              return (
                <motion.div
                  key={`star-fg-${i}`}
                  className="absolute rounded-full bg-white"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    boxShadow: currentPhase >= 3 ? `0 0 ${size * 2}px rgba(255, 255, 255, 0.3)` : 'none',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [baseOpacity * 0.6, baseOpacity, baseOpacity * 0.6],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    opacity: { duration: 2.5, delay, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 2.5, delay, repeat: Infinity, ease: 'easeInOut' },
                  }}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Drifting clouds (Phase 3+) */}
      {currentPhase >= 3 && !prefersReducedMotion && (
        <div className="absolute inset-0 z-8 pointer-events-none overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => {
            const startY = 10 + i * 15;
            const duration = 40 + i * 10;
            const delay = i * 5;
            const height = 80 + Math.random() * 40;
            
            return (
              <motion.div
                key={`cloud-${i}`}
                className="absolute w-64 opacity-[0.03]"
                style={{
                  top: `${startY}%`,
                  height: `${height}px`,
                  background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
                  filter: 'blur(30px)',
                }}
                initial={{ x: '-30%' }}
                animate={{ x: '130%' }}
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

      {/* Ripples from Leo (Phase 1 Beat 2) */}
      {currentBeat === 2 && !prefersReducedMotion && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={`ripple-${i}`}
              className="absolute rounded-full border-2 border-pink-300/20"
              style={{
                width: '100px',
                height: '100px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 4],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 1,
                ease: [0.4, 0, 0.2, 1],
              }}
            />
          ))}
        </div>
      )}

      {/* Dust motes (Phase 1 Beat 2 onwards) */}
      {currentBeat >= 2 && !prefersReducedMotion && (
        <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
          {Array.from({ length: currentPhase >= 2 ? 60 : 40 }).map((_, i) => {
            const startX = 10 + Math.random() * 80;
            const startY = 60 + Math.random() * 40;
            const endY = -10;
            const drift = (Math.random() - 0.5) * 40;
            const duration = currentBeat === 4 ? 20 : 8 + Math.random() * 4; // Slow in Beat 4
            const delay = Math.random() * 4;
            const size = 1 + Math.random() * 2;
            const speed = currentPhase >= 2 ? 18 : 12; // Faster in Phase 2+
            
            return (
              <motion.div
                key={`mote-${i}`}
                className="absolute rounded-full bg-white/20 blur-[0.5px]"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${startX}%`,
                }}
                initial={{ 
                  y: `${startY}vh`, 
                  x: 0,
                  opacity: 0,
                }}
                animate={{
                  y: currentBeat === 4 ? [`${startY}vh`, `${startY - 5}vh`, `${startY - 3}vh`] : `${endY}vh`, // Pause in Beat 4
                  x: `${drift}%`,
                  opacity: [0, 0.4, 0.4, 0],
                }}
                transition={{
                  duration,
                  delay,
                  repeat: Infinity,
                  ease: currentBeat === 4 ? [0.4, 0, 0.6, 1] : 'linear',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Leo - center character with breathing, floating, and cinematic glow */}
      <motion.div
        className="absolute z-20"
        style={{
          left: '50%',
          top: currentPhase <= 2 ? '50%' : '35%',
        }}
        initial={{ x: '-50%', y: '-50%' }}
        animate={{
          x: currentPhase === 5 ? '-50%' : '-50%',
          y: currentPhase === 5 
            ? ['calc(-50% + -60px)', 'calc(-50% + -80px)'] // Arc forward during zoom
            : `calc(-50% + ${getLeoTransform().y}px)`,
          scale: currentPhase === 5 ? 1.2 : getLeoTransform().scale,
          rotate: currentPhase >= 3 ? [-1, 1, -1] : 0, // Gentle tilt in Phase 3+
        }}
        transition={{
          y: { duration: currentPhase === 5 ? 8 : (currentBeat === 4 ? 6 : 2), ease: [0.4, 0, 0.2, 1] },
          scale: { duration: currentPhase === 5 ? 6 : 5, ease: [0.4, 0, 0.2, 1] },
          rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        {/* Glow particles trailing Leo (Phase 3+) */}
        {currentPhase >= 3 && !prefersReducedMotion && (
          <div className="absolute inset-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={`glow-particle-${i}`}
                className="absolute rounded-full bg-pink-300/40 blur-sm"
                style={{
                  width: '8px',
                  height: '8px',
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, (Math.random() - 0.5) * 40],
                  y: [0, 20 + Math.random() * 30],
                  opacity: [0.4, 0],
                  scale: [1, 0],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>
        )}

        {/* Leo SVG with gentle floating and lens bloom */}
        <motion.div
          animate={{
            y: [-8, 8, -8],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: typeof window !== 'undefined' && window.innerWidth < 768 ? '160px' : '200px',
            height: typeof window !== 'undefined' && window.innerWidth < 768 ? '160px' : '200px',
          }}
        >
          <motion.div
            animate={
              currentPhase >= 3 && !prefersReducedMotion
                ? {
                    filter: [
                      'brightness(1) drop-shadow(0 0 0px rgba(255, 192, 203, 0))',
                      'brightness(1.15) drop-shadow(0 0 30px rgba(255, 192, 203, 0.5))',
                      'brightness(1) drop-shadow(0 0 0px rgba(255, 192, 203, 0))',
                    ],
                  }
                : {}
            }
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Image
              src="/images/leo.svg"
              alt="Leo"
              width={typeof window !== 'undefined' && window.innerWidth < 768 ? 160 : 200}
              height={typeof window !== 'undefined' && window.innerWidth < 768 ? 160 : 200}
              priority
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Background silhouette skyline (Phase 3 'emerge'+) */}
      {skylineVisible && currentPhase >= 3 && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-48 z-24 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 4, ease: 'easeOut' }}
        >
          {/* Low contrast silhouettes behind main towers */}
          <div className="absolute bottom-0 left-0 right-0 h-full">
            {Array.from({ length: 12 }).map((_, i) => {
              const width = 30 + Math.random() * 60;
              const height = 60 + Math.random() * 120;
              const left = (i / 12) * 100;
              
              return (
                <div
                  key={`silhouette-${i}`}
                  className="absolute bottom-0 bg-black/20"
                  style={{
                    left: `${left}%`,
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Horizon haze / light pollution glow (Phase 3+) */}
      {currentPhase >= 3 && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-40 z-23 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(255, 220, 180, 0.08), transparent)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: skylineVisible ? 1 : 0 }}
          transition={{ duration: 5, ease: 'easeOut' }}
        />
      )}

      {/* Ambient shimmer when towers begin to rise - fluid breathing glow */}
      {towersRising && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 z-24 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 50% 80%, rgba(180, 160, 255, 0) 0%, transparent 60%)',
              'radial-gradient(circle at 50% 80%, rgba(180, 160, 255, 0.05) 20%, transparent 70%)',
              'radial-gradient(circle at 50% 80%, rgba(180, 160, 255, 0) 0%, transparent 60%)',
            ],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: [0.45, 0.05, 0.55, 0.95], // Breathing rhythm
          }}
        />
      )}

      {/* City skyline with six towers (Phase 4 or Phase 5 zoom) */}
      {towersRising && currentPhase >= 4 && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-25"
          style={{ height: '50vh' }}
        >
          {/* Six emotional towers - no zoom, just fade/highlight transition */}
          {TOWERS.map((tower, idx) => {
            const isPrimary = primaryEmotion === tower.id;
            const isTransitionPhase = currentPhase === 5;
            const baseOpacity = getCityPulseBrightness();
            const towerOpacity = isPrimary ? 0.8 : baseOpacity;
            
            // During transition: fade out non-primary towers, reposition primary to center
            const fadeOutOpacity = isTransitionPhase && !isPrimary ? 0.1 : 1;
            const repositionX = isTransitionPhase && isPrimary ? '50%' : `${tower.x}%`;
            
            return (
              <motion.div
                key={tower.id}
                className="absolute bottom-0"
                style={{
                  width: '80px', // Wider towers
                  height: `${tower.height * 1.8}px`, // Taller (1.8x)
                }}
                initial={{ 
                  left: `${tower.x}%`,
                  y: 40, 
                  opacity: 0 
                }}
                animate={{ 
                  left: repositionX,
                  transform: isPrimary && isTransitionPhase ? 'translateX(-50%)' : 'translateX(0)',
                  y: 0, 
                  opacity: fadeOutOpacity,
                  scale: isPrimary && isTransitionPhase ? 1.2 : 1,
                }}
                transition={{
                  initial: {
                    duration: 2,
                    delay: idx * 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  left: { duration: 2, ease: [0.22, 1, 0.36, 1] },
                  transform: { duration: 2, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 1.5, ease: 'easeOut' },
                  scale: { duration: 2, ease: [0.22, 1, 0.36, 1] },
                }}
              >
                {/* Tower silhouette with gradient */}
                <div
                  className="w-full h-full relative overflow-hidden"
                  style={{
                    background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                    boxShadow: isPrimary 
                      ? `0 0 40px ${tower.color}80, inset 0 -20px 40px ${tower.color}30`
                      : `0 0 20px ${tower.color}20`,
                    border: `1px solid ${tower.color}40`,
                    borderRadius: '2px 2px 0 0',
                  }}
                >
                  {/* Windows grid - organic breathing pulse like heartbeats */}
                  <div className="absolute inset-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: Math.floor((tower.height * 1.8) / 25) * 4 }).map((_, i) => {
                      // Create organic rhythm: some windows breathe fast, some slow
                      const breathPattern = Math.random();
                      const baseDelay = i * 0.15; // Cascading effect
                      const cycleDuration = 2.5 + breathPattern * 3.5; // 2.5s to 6s cycles
                      
                      // Deeper dimming for more organic feel
                      const minOpacity = 0.1 + (breathPattern * 0.15);
                      const maxOpacity = 0.5 + (breathPattern * 0.35);
                      
                      return (
                        <motion.div
                          key={`window-${tower.id}-${i}`}
                          className="bg-white/0 rounded-[1px]"
                          animate={{
                            backgroundColor: [
                              `rgba(248, 216, 181, ${towerOpacity * minOpacity})`,
                              `rgba(255, 230, 200, ${towerOpacity * maxOpacity})`, // Warmer peak
                              `rgba(248, 216, 181, ${towerOpacity * minOpacity})`,
                            ],
                            boxShadow: [
                              'inset 0 0 0px rgba(248, 216, 181, 0)',
                              `inset 0 0 2px rgba(255, 230, 200, ${towerOpacity * 0.5})`,
                              'inset 0 0 0px rgba(248, 216, 181, 0)',
                            ],
                          }}
                          transition={{
                            duration: cycleDuration,
                            repeat: Infinity,
                            delay: (idx * 0.5) + baseDelay,
                            ease: [0.45, 0.05, 0.55, 0.95], // easeInOutSine for breathing
                          }}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Roofline accent light - fluid breathing */}
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${tower.color}60, transparent)`,
                    }}
                    animate={{
                      opacity: [0.2, 0.8, 0.2],
                      scaleX: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 5 + idx * 0.5,
                      repeat: Infinity,
                      ease: [0.45, 0.05, 0.55, 0.95], // Breathing rhythm
                    }}
                  />
                  
                  {/* Tower name (visible when primary, enhanced during transition) */}
                  {isPrimary && (
                    <motion.div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-serif italic"
                      style={{ color: tower.color, textShadow: `0 0 10px ${tower.color}` }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: 1, 
                y: 0,
                        scale: isTransitionPhase ? [1, 1.2] : 1, // Grow during transition
                      }}
                      transition={{ 
                        duration: 2, 
                        ease: 'easeOut',
                        scale: { duration: 3, ease: [0.22, 1, 0.36, 1] }
                      }}
                    >
                      {tower.name}
                    </motion.div>
                  )}
                  
                  {/* Halo emergence (Phase 5 transition) */}
                  {isPrimary && isTransitionPhase && zoomStartTime && (
                    <motion.div
                      className="absolute -top-20 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${tower.color}40 0%, transparent 70%)`,
                        filter: 'blur(15px)',
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 0.6, 0.8],
                        scale: [0, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        delay: 0.5, // Start quickly
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Copy display - positioned below Leo, persist phase 3 with rotation */}
      <div className="absolute bottom-24 md:bottom-32 left-0 right-0 z-30 flex flex-col items-center px-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {showCopy && (
            <motion.p
              key={showCopy}
              className="text-xl md:text-2xl lg:text-3xl font-serif italic text-center tracking-wide leading-relaxed"
              style={{
                color: currentPhase >= 3 ? '#E8D5F2' : '#7D2054',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                // Keep rotating and pulsing after phase 3 text appears
                scale: showCopy === COPY.phase3 ? [1, 1.02, 1] : 1,
                rotate: showCopy === COPY.phase3 ? [0, 0.5, 0, -0.5, 0] : 0,
              }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ 
                opacity: { duration: 1.5, ease: [0.45, 0.05, 0.55, 0.95] },
                y: { duration: 1.5, ease: [0.45, 0.05, 0.55, 0.95] },
                scale: { duration: 4, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] },
                rotate: { duration: 6, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] },
              }}
            >
              {showCopy}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Vignette (Phase 1+) */}
      {currentBeat >= 1 && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-40"
          style={{
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.3) 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: currentPhase >= 3 ? 0.08 : 0.04 }}
          transition={{ duration: 2 }}
        />
      )}

      {/* Subtle progress indicator (accessibility) */}
      <div className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
        <motion.div
          className="flex gap-1.5"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          role="status"
          aria-live="polite"
          aria-label="Processing your reflection"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full"
              style={{
                backgroundColor: currentPhase >= 3 ? '#E8D5F2' : '#7D2054',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

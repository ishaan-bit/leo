'use client';

import { useState, useEffect } from 'react';
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
 * - Skyline with 6 emotional towers (fade in on line 3 of "Held Safe")
 * - Crescent moon for null/none emotion states
 * - Building pulse and fade logic based on emotion detection
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
  heldSafeLineIndex?: number; // Track which line of "Held Safe" is showing (0-2)
  primaryEmotion?: string | null; // 'null' = no emotion, undefined = not loaded yet
}

// Easing curve for breathing motion
const breathingCurve = [0.4, 0, 0.2, 1];

// Emotional towers (matching BreathingSequence layout)
const TOWERS = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 180 },
  { id: 'powerful', name: 'Ashmere', color: '#FF6B35', x: 25, height: 220 },
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 40, height: 160 },
  { id: 'sad', name: 'Vanta', color: '#7D8597', x: 55, height: 200 },
  { id: 'scared', name: 'Vire', color: '#5A189A', x: 70, height: 190 },
  { id: 'mad', name: 'Sable', color: '#C1121F', x: 85, height: 170 },
];

export default function InterludeVisuals({
  phase,
  pigName,
  reduceMotion = false,
  heldSafeLineIndex = 0,
  primaryEmotion,
}: InterludeVisualsProps) {
  const [pulseCount, setPulseCount] = useState(0);
  
  // Animation parameters based on reduce motion
  const glowIntensity = reduceMotion ? 0.15 : 0.4;
  const particleCount = reduceMotion ? 4 : 8;
  const waveCount = reduceMotion ? 1 : 3;
  
  // Show skyline on line 3 of "Held Safe" (index 2) - "time holding its breath"
  const showSkyline = phase === 'held_safe' && heldSafeLineIndex >= 2;
  
  // Determine if we should show moon (null or "none" emotion)
  // For null emotion: show BOTH moon AND first building pulsing together
  const isNullEmotion = primaryEmotion === null || primaryEmotion === 'none';
  const showMoon = showSkyline && isNullEmotion;
  
  // Track pulse count for fade logic
  useEffect(() => {
    if (!showSkyline || !primaryEmotion || isNullEmotion) return;
    
    const pulseInterval = setInterval(() => {
      setPulseCount(prev => prev + 1);
    }, 3000); // Count pulses every 3s (window animation cycle)
    
    return () => clearInterval(pulseInterval);
  }, [showSkyline, primaryEmotion, isNullEmotion]);

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
      
      {/* City skyline - fades in on line 3 of "Held Safe" */}
      {showSkyline && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-15"
          style={{ height: '50vh' }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2, ease: breathingCurve }}
        >
          {TOWERS.map((tower, idx) => {
            // For null emotion: show FIRST tower (Vera - joyful) pulsing with moon
            // For detected emotion: show matching primary tower only
            const isPrimary = isNullEmotion 
              ? tower.id === 'joyful' // First tower for null emotion
              : tower.id === primaryEmotion;
            
            const shouldFade = pulseCount >= 1 && !isPrimary; // Fade non-primary after 1 pulse
            
            return (
              <motion.div
                key={tower.id}
                className="absolute bottom-0"
                style={{
                  left: `${tower.x}%`,
                  width: '80px',
                  height: `${tower.height * 1.8}px`,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: isPrimary ? 1 : 0, // Only show primary tower
                  y: 0,
                }}
                transition={{
                  y: { duration: 1.5, delay: idx * 0.2, ease: 'easeOut' },
                  opacity: { duration: 1.5 },
                }}
              >
                {/* Tower body */}
                <div
                  className="w-full h-full relative"
                  style={{
                    background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                    border: `1px solid ${tower.color}40`,
                    borderRadius: '2px 2px 0 0',
                  }}
                >
                  {/* Pulsating windows - synchronized breathing pulse for primary */}
                  <div className="absolute inset-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: Math.floor((tower.height * 1.8) / 25) * 4 }).map((_, i) => (
                      <motion.div
                        key={`window-${tower.id}-${i}`}
                        className="rounded-[1px]"
                        animate={
                          isPrimary
                            ? {
                                // Synchronized pulse for primary building
                                backgroundColor: [
                                  `rgba(248, 216, 181, 0.2)`,
                                  `rgba(255, 230, 200, 0.7)`,
                                  `rgba(248, 216, 181, 0.2)`,
                                ],
                              }
                            : {
                                // Original staggered animation for non-primary
                                backgroundColor: [
                                  `rgba(248, 216, 181, 0.15)`,
                                  `rgba(255, 230, 200, 0.5)`,
                                  `rgba(248, 216, 181, 0.15)`,
                                ],
                              }
                        }
                        transition={
                          isPrimary
                            ? {
                                duration: 5, // Match breathing cycle
                                repeat: Infinity,
                                ease: breathingCurve,
                              }
                            : {
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: idx * 0.5 + i * 0.1,
                                ease: [0.45, 0.05, 0.55, 0.95],
                              }
                        }
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      
      {/* Crescent moon - shows only for null/none emotion */}
      {showMoon && (
        <motion.div
          className="fixed z-20"
          style={{
            left: '50%',
            top: '25%',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0.7, 1, 0.7],
            scale: 1,
          }}
          transition={{
            opacity: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 1.5, ease: breathingCurve },
          }}
        >
          {/* Crescent moon SVG */}
          <svg width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <filter id="moonGlow">
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path
              d="M 60 10 A 40 40 0 1 0 60 110 A 35 35 0 1 1 60 10 Z"
              fill="#FFF9E6"
              filter="url(#moonGlow)"
              opacity="0.9"
            />
          </svg>
          
          {/* Moon glow */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 249, 230, 0.4) 0%, transparent 70%)',
              filter: 'blur(30px)',
              transform: 'scale(1.5)',
            }}
            animate={{
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.div>
      )}
    </>
  );
}

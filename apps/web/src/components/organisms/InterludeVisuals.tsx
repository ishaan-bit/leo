'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import PinkPig from '../molecules/PinkPig';

/**
 * InterludeVisuals - Option 3 Aesthetic
 * 
 * Visual Flow:
 * 1. held_safe: Static, soft glow on pig
 * 2. interlude_active: Sparkles drift → dissolve, gradient shift (pink → lavender), pig pulse/breathe
 * 3. complete_transition: Sparkles clear, focus ring on pig, brightness increase
 * 
 * Accessibility:
 * - Respects prefers-reduced-motion: disables drift, uses opacity/blur only
 * - Keeps timing identical regardless of motion setting
 */

type InterludePhase = 'held_safe' | 'interlude_active' | 'complete_transition' | 'progress_ready';

interface InterludeVisualsProps {
  phase: InterludePhase;
  pigName: string;
  reduceMotion?: boolean;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export default function InterludeVisuals({ 
  phase, 
  pigName,
  reduceMotion = false 
}: InterludeVisualsProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  
  // Generate sparkles on interlude start
  useEffect(() => {
    if (phase === 'interlude_active') {
      const newSparkles: Sparkle[] = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: 20 + Math.random() * 60, // Start from 20-80% height
        size: 2 + Math.random() * 4,
        duration: 3 + Math.random() * 2,
        delay: i * 0.15, // Staggered appearance
      }));
      
      setSparkles(newSparkles);
    } else if (phase === 'complete_transition') {
      // Clear sparkles
      setSparkles([]);
    }
  }, [phase]);
  
  return (
    <>
      {/* Dynamic gradient background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: phase === 'held_safe'
            ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)'
            : phase === 'interlude_active'
            ? [
                'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                'linear-gradient(135deg, #fae8ff 0%, #e9d5ff 100%)', // Pink → Lavender
                'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
              ]
            : 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
        }}
        transition={{
          duration: phase === 'interlude_active' ? 12 : 1.5,
          repeat: phase === 'interlude_active' ? Infinity : 0,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
      
      {/* Breathing overlay gradient */}
      {phase !== 'held_safe' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 30% 40%, rgba(251, 207, 232, 0.2), transparent 60%)',
              'radial-gradient(circle at 70% 60%, rgba(251, 207, 232, 0.3), transparent 60%)',
              'radial-gradient(circle at 30% 40%, rgba(251, 207, 232, 0.2), transparent 60%)',
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      
      {/* Sparkles - drift upward and dissolve */}
      <AnimatePresence>
        {phase === 'interlude_active' && sparkles.map((sparkle) => (
          <motion.div
            key={sparkle.id}
            className="absolute rounded-full bg-pink-300/60 backdrop-blur-sm"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: sparkle.size,
              height: sparkle.size,
            }}
            initial={{ 
              opacity: 0, 
              y: 0,
              scale: 0,
            }}
            animate={reduceMotion ? {
              // Reduced motion: only fade in/out, no movement
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0.8],
            } : {
              // Full motion: drift upward
              opacity: [0, 0.6, 0],
              y: [-50, -200],
              x: [0, (Math.random() - 0.5) * 40], // Slight horizontal drift
              scale: [0, 1, 0.8],
              rotate: [0, 360],
            }}
            transition={{
              duration: sparkle.duration,
              delay: sparkle.delay,
              ease: 'easeOut',
              times: [0, 0.3, 1], // Fade in quickly, then dissolve
            }}
          />
        ))}
      </AnimatePresence>
      
      {/* Pig - centered with breathing pulse */}
      <div className="relative z-10 flex items-center justify-center">
        <motion.div
          animate={
            phase === 'held_safe'
              ? {
                  // Static soft glow
                  filter: 'drop-shadow(0 0 20px rgba(251, 207, 232, 0.4))',
                }
              : phase === 'interlude_active'
              ? {
                  // Breathing pulse
                  scale: [1, 1.05, 1],
                  filter: [
                    'drop-shadow(0 0 20px rgba(251, 207, 232, 0.4))',
                    'drop-shadow(0 0 40px rgba(251, 207, 232, 0.6))',
                    'drop-shadow(0 0 20px rgba(251, 207, 232, 0.4))',
                  ],
                }
              : {
                  // Complete: bright focus ring
                  scale: 1,
                  filter: [
                    'drop-shadow(0 0 40px rgba(251, 207, 232, 0.6))',
                    'drop-shadow(0 0 60px rgba(251, 207, 232, 0.8))',
                  ],
                }
          }
          transition={{
            duration: phase === 'interlude_active' ? 3 : phase === 'complete_transition' ? 1 : 0,
            repeat: phase === 'interlude_active' ? Infinity : phase === 'complete_transition' ? 1 : 0,
            ease: 'easeInOut',
          }}
        >
          <PinkPig
            size={240}
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
      </div>
      
      {/* Complete transition: soft focus ring */}
      {phase === 'complete_transition' && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0, 0.4, 0],
            scale: [0.8, 1.3, 1.5],
          }}
          transition={{
            duration: 2,
            ease: 'easeOut',
          }}
        >
          <div 
            className="w-80 h-80 rounded-full border-4 border-pink-300/40"
            style={{
              boxShadow: '0 0 60px rgba(251, 207, 232, 0.6)',
            }}
          />
        </motion.div>
      )}
      
      {/* Atmospheric shimmer particles (background, subtle) */}
      {phase === 'interlude_active' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={`shimmer-${i}`}
              className="absolute w-1 h-1 bg-pink-200/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={reduceMotion ? {
                opacity: [0.1, 0.3, 0.1],
              } : {
                opacity: [0.1, 0.3, 0.1],
                y: [0, -30, 0],
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

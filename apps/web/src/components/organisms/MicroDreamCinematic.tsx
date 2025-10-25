'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// Timings configuration (all in ms)
const timings = {
  entrance: {
    fadeIn: 700,
    statusChipDelay: 300,
  },
  lines: {
    charDelay: 24, // ms per character
    charJitter: 6, // random ±6ms
    bloomDuration: 500,
    l2FadeDelay: 800,
    l2FadeDuration: 500,
    holdDuration: 3500, // total on-screen time
  },
  fades: {
    crossfadeDuration: 900,
  },
  exit: {
    dissolve: 650,
    irisIn: 150,
    whiteOverlay: 250,
  },
};

type PrimaryEmotion = 'sad' | 'joyful' | 'powerful' | 'mad' | 'peaceful' | 'scared';

interface MicroDream {
  lines: string[];
  fades?: string[];
  dominant_primary?: PrimaryEmotion;
  valence_mean?: number;
  arousal_mean?: number;
  createdAt?: string;
  algo?: string;
  owner_id?: string;
}

interface MicroDreamCinematicProps {
  dream: MicroDream;
  pigName?: string;
  onComplete?: () => void;
}

// Emotion-based hue bias mapping
const emotionThemes: Record<PrimaryEmotion, { hue: number; sat: number; contrast: number }> = {
  scared: { hue: -8, sat: -5, contrast: 2 }, // blue-violet bias
  joyful: { hue: 10, sat: 5, contrast: -2 }, // magenta/orange bias
  sad: { hue: -12, sat: -8, contrast: 0 }, // deep blue
  powerful: { hue: 6, sat: 3, contrast: 3 }, // warm red
  mad: { hue: -15, sat: 8, contrast: 5 }, // intense red-violet
  peaceful: { hue: 4, sat: -3, contrast: -3 }, // soft green-blue
};

export default function MicroDreamCinematic({ dream, pigName = 'Your Pig', onComplete }: MicroDreamCinematicProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'entering' | 'dreaming' | 'waking' | 'exiting'>('entering');
  const [line1Text, setLine1Text] = useState('');
  const [showLine2, setShowLine2] = useState(false);
  const [currentFadeIndex, setCurrentFadeIndex] = useState(0);
  const [showBloom, setShowBloom] = useState(false);
  
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  const line1 = dream.lines[0] || 'A quiet pause found me.';
  const line2 = dream.lines[1] || 'Take a gentle breath.';
  const emotionTheme = dream.dominant_primary ? emotionThemes[dream.dominant_primary] : emotionThemes.peaceful;

  // Type-on animation for line 1
  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip type-on for reduced motion
      setLine1Text(line1);
      setShowBloom(true);
      return;
    }

    let currentIndex = 0;
    const chars = line1.split('');
    
    const typeInterval = setInterval(() => {
      if (currentIndex < chars.length) {
        setLine1Text(prev => prev + chars[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        // Trigger bloom pulse
        setShowBloom(true);
      }
    }, timings.lines.charDelay + Math.random() * timings.lines.charJitter - timings.lines.charJitter / 2);

    return () => clearInterval(typeInterval);
  }, [line1, prefersReducedMotion]);

  // Show line 2 after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLine2(true);
    }, timings.lines.l2FadeDelay);

    return () => clearTimeout(timer);
  }, []);

  // Fades ticker rotation
  useEffect(() => {
    if (!dream.fades || dream.fades.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFadeIndex(prev => (prev + 1) % dream.fades!.length);
    }, timings.fades.crossfadeDuration);

    return () => clearInterval(interval);
  }, [dream.fades]);

  // Transition to waking phase
  useEffect(() => {
    const wakeTimer = setTimeout(() => {
      setPhase('waking');
    }, timings.lines.holdDuration);

    return () => clearTimeout(wakeTimer);
  }, []);

  // Exit sequence
  useEffect(() => {
    if (phase === 'waking') {
      const exitTimer = setTimeout(() => {
        setPhase('exiting');
        
        // Navigate after iris-in completes
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            router.push('/write');
          }
        }, timings.exit.irisIn + timings.exit.whiteOverlay);
      }, 1200);

      return () => clearTimeout(exitTimer);
    }
  }, [phase, onComplete, router]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setPhase('waking');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        console.log('[Telemetry] micro_dream.skip');
        if (onComplete) {
          onComplete();
        } else {
          router.push('/write');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete, router]);

  // Telemetry on mount
  useEffect(() => {
    console.log('[Telemetry] micro_dream.view', {
      algo: dream.algo,
      createdAt: dream.createdAt,
      dominant_primary: dream.dominant_primary,
      valence_mean: dream.valence_mean,
      arousal_mean: dream.arousal_mean,
      lines_hash: `${dream.lines[0]?.slice(0, 10)}...`,
    });

    return () => {
      if (phase === 'exiting') {
        console.log('[Telemetry] micro_dream.complete');
      }
    };
  }, []);

  const handleTapToContinue = () => {
    console.log('[Telemetry] micro_dream.advance_user');
    setPhase('waking');
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden"
      onClick={handleTapToContinue}
      style={{
        background: 'linear-gradient(135deg, #35003a, #1c0840, #001b2a)',
      }}
    >
      {/* Animated hue shift layer */}
      <motion.div
        className="absolute inset-0"
        animate={prefersReducedMotion ? {} : {
          filter: [
            `hue-rotate(${emotionTheme.hue - 12}deg) saturate(${100 + emotionTheme.sat}%) contrast(${100 + emotionTheme.contrast}%)`,
            `hue-rotate(${emotionTheme.hue + 12}deg) saturate(${100 + emotionTheme.sat + 5}%) contrast(${100 + emotionTheme.contrast}%)`,
            `hue-rotate(${emotionTheme.hue - 12}deg) saturate(${100 + emotionTheme.sat}%) contrast(${100 + emotionTheme.contrast}%)`,
          ],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* RGB Glows */}
        <div
          className="absolute opacity-28 mix-blend-screen"
          style={{
            left: '25%',
            top: '60%',
            width: '55vmax',
            height: '55vmax',
            background: 'radial-gradient(circle, rgba(255, 50, 80, 0.6) 0%, transparent 70%)',
            filter: 'blur(80px)',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute opacity-22 mix-blend-screen"
          style={{
            right: '25%',
            top: '30%',
            width: '45vmax',
            height: '45vmax',
            background: 'radial-gradient(circle, rgba(50, 255, 120, 0.6) 0%, transparent 70%)',
            filter: 'blur(80px)',
            transform: 'translate(50%, -50%)',
          }}
        />
        <div
          className="absolute opacity-26 mix-blend-screen"
          style={{
            left: '50%',
            bottom: '0',
            width: '65vmax',
            height: '65vmax',
            background: 'radial-gradient(circle, rgba(50, 120, 255, 0.6) 0%, transparent 70%)',
            filter: 'blur(80px)',
            transform: 'translate(-50%, 50%)',
          }}
        />
      </motion.div>

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.35\'/%3E%3C/svg%3E")',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Entrance fade overlay */}
      <AnimatePresence>
        {phase === 'entering' && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: timings.entrance.fadeIn / 1000, ease: 'easeOut' }}
            className="absolute inset-0 bg-black pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Exit iris-in effect */}
      <AnimatePresence>
        {phase === 'exiting' && (
          <motion.div
            initial={{ clipPath: 'circle(100% at 50% 50%)' }}
            animate={{ clipPath: 'circle(0% at 50% 50%)' }}
            transition={{ duration: timings.exit.irisIn / 1000, ease: 'easeIn' }}
            className="absolute inset-0 bg-white pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* Status chip */}
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: timings.entrance.statusChipDelay / 1000, duration: 0.4 }}
        className="absolute top-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="backdrop-blur-md bg-white/8 border border-white/10 rounded-full px-4 py-1.5 text-sm tracking-wide text-white/90">
          {phase === 'waking' || phase === 'exiting' ? (
            <span>🌅 {pigName} is waking up…</span>
          ) : (
            <span>✨ {pigName} is dreaming…</span>
          )}
        </div>
      </motion.div>

      {/* Main content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 md:px-12">
        {/* Screen reader live region */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {line1Text} {showLine2 ? line2 : ''}
        </div>

        {/* Lines */}
        <motion.div
          className="max-w-4xl text-center space-y-6"
          animate={phase === 'waking' || phase === 'exiting' ? {
            opacity: 0,
            filter: 'saturate(140%) blur(1.2px)',
          } : {}}
          transition={{ duration: timings.exit.dissolve / 1000 }}
        >
          {/* Line 1 with bloom */}
          <motion.h1
            className="text-3xl md:text-5xl lg:text-6xl font-serif leading-tight tracking-wide text-white/95"
            style={{
              textShadow: `
                0 0 20px rgba(255, 255, 255, 0.25),
                2px 2px 4px rgba(255, 255, 255, 0.15),
                -1px -1px 3px rgba(255, 100, 100, 0.06),
                1px -1px 3px rgba(100, 255, 100, 0.06),
                -1px 1px 3px rgba(100, 100, 255, 0.06)
              `,
            }}
            animate={showBloom && !prefersReducedMotion ? {
              scale: [1, 1.02, 1],
            } : {}}
            transition={{ duration: timings.lines.bloomDuration / 1000 }}
          >
            {line1Text}
          </motion.h1>

          {/* Line 2 */}
          <AnimatePresence>
            {showLine2 && (
              <motion.p
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 0.9, y: 0 }}
                transition={{ duration: timings.lines.l2FadeDuration / 1000 }}
                className="text-xl md:text-2xl text-white/90"
                style={{
                  textShadow: '0 0 15px rgba(255, 255, 255, 0.2)',
                }}
              >
                {line2}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Fades ticker (bottom center) */}
      {dream.fades && dream.fades.length > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFadeIndex}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0.15 }}
              transition={{ duration: timings.fades.crossfadeDuration / 2000 }}
              className="text-xs text-white/40 font-mono mix-blend-screen"
            >
              #{dream.fades[currentFadeIndex]?.slice(-8)}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Tap to continue affordance */}
      {phase === 'dreaming' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5, y: [0, -4, 0] }}
          transition={{
            opacity: { delay: 2, duration: 0.6 },
            y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50 tracking-wide"
        >
          tap or press any key to continue
        </motion.div>
      )}

      {/* Skip link for screen readers */}
      <a
        href="#skip-dream"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded-md focus:z-50"
        onClick={(e) => {
          e.preventDefault();
          console.log('[Telemetry] micro_dream.skip');
          if (onComplete) {
            onComplete();
          } else {
            router.push('/write');
          }
        }}
      >
        Skip dream and start writing
      </a>
    </div>
  );
}

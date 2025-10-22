'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type PrimaryEmotion,
  computeBreatheParams,
  calculateTotalCycles,
  FALLBACK_WORDS,
  WORD_DRIFT_PX,
} from '@/lib/breathe-config';

interface BreathingSequenceProps {
  reflectionId: string;
  primary: PrimaryEmotion;
  secondary?: string;
  zoneName: string;
  zoneColor: string;
  invokedWords?: string[];
  onComplete: () => void;
}

type BreathePhase = 'neon_reveal' | 'breathe_init' | 'breathe_loop' | 'breathe_outro' | 'complete';
type CycleStage = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export default function BreathingSequence({
  reflectionId,
  primary,
  secondary,
  zoneName,
  zoneColor,
  invokedWords = [],
  onComplete,
}: BreathingSequenceProps) {
  const [phase, setPhase] = useState<BreathePhase>('neon_reveal');
  const [cycleStage, setCycleStage] = useState<CycleStage>('inhale');
  const [currentCycle, setCurrentCycle] = useState(0);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [showCue, setShowCue] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordPoolRef = useRef<string[]>([]);
  
  // Compute breathing parameters
  const breatheParams = computeBreatheParams(primary, secondary);
  const totalCycles = calculateTotalCycles(breatheParams.cycle);
  const { cycle, light, color, audio, cueHint } = breatheParams;

  // Initialize word pool
  useEffect(() => {
    const words = invokedWords.length > 0 ? invokedWords : FALLBACK_WORDS;
    wordPoolRef.current = [...words];
    
    console.log('[BreathingSequence] Initialized:', {
      primary,
      secondary,
      zoneName,
      totalCycles,
      cycle,
      wordPool: wordPoolRef.current,
    });
  }, [invokedWords, primary, secondary, zoneName, totalCycles, cycle]);

  // Neon reveal phase (3s)
  useEffect(() => {
    if (phase === 'neon_reveal') {
      console.log('[BreathingSequence] 🌟 Neon reveal starting');
      
      // Telemetry
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('breathe_started', {
            detail: { rid: reflectionId, primary, tower: zoneName, timestamp: new Date().toISOString() },
          })
        );
      }
      
      const timer = setTimeout(() => {
        setPhase('breathe_init');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, reflectionId, primary, zoneName]);

  // Initialize breathing (load audio, short pause)
  useEffect(() => {
    if (phase === 'breathe_init') {
      console.log('[BreathingSequence] 🫁 Breathe init - loading audio:', audio);
      
      // Load and play audio
      if (typeof window !== 'undefined' && audio) {
        const audioEl = new Audio(audio);
        audioEl.loop = true;
        audioEl.volume = 0.6;
        audioEl.play().catch((err) => console.warn('[BreathingSequence] Audio play failed:', err));
        audioRef.current = audioEl;
      }
      
      const timer = setTimeout(() => {
        setPhase('breathe_loop');
        setCycleStage('inhale');
        setCurrentCycle(0);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, audio]);

  // Pick random word from pool
  const pickWord = useCallback(() => {
    if (wordPoolRef.current.length === 0) {
      // Refill pool
      wordPoolRef.current = invokedWords.length > 0 ? [...invokedWords] : [...FALLBACK_WORDS];
    }
    
    const idx = Math.floor(Math.random() * wordPoolRef.current.length);
    const word = wordPoolRef.current[idx];
    wordPoolRef.current.splice(idx, 1); // Remove to avoid repeats
    
    return word;
  }, [invokedWords]);

  // Breathing loop state machine
  useEffect(() => {
    if (phase !== 'breathe_loop') return;
    
    const { in: inhale, h1, out: exhale, h2 } = cycle;
    let timer: NodeJS.Timeout;
    
    const advance = () => {
      if (cycleStage === 'inhale') {
        timer = setTimeout(() => setCycleStage('hold1'), inhale * 1000);
      } else if (cycleStage === 'hold1') {
        timer = setTimeout(() => setCycleStage('exhale'), h1 * 1000);
      } else if (cycleStage === 'exhale') {
        timer = setTimeout(() => {
          setCycleStage('hold2');
          
          // Show word on exhale end
          const word = pickWord();
          setCurrentWord(word);
          
          // Telemetry
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('word_invoked', {
                detail: {
                  rid: reflectionId,
                  word,
                  cycle: currentCycle + 1,
                  source: invokedWords.length > 0 ? 'invoked' : 'fallback',
                },
              })
            );
          }
          
          // Clear word after 1.5s
          setTimeout(() => setCurrentWord(null), 1500);
        }, exhale * 1000);
      } else if (cycleStage === 'hold2') {
        timer = setTimeout(() => {
          const nextCycle = currentCycle + 1;
          
          // Telemetry
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('cycle_tick', {
                detail: { rid: reflectionId, cycle: nextCycle, primary, tower: zoneName },
              })
            );
          }
          
          if (nextCycle >= totalCycles) {
            // End breathing loop
            setPhase('breathe_outro');
          } else {
            setCurrentCycle(nextCycle);
            setCycleStage('inhale');
            
            // Hide cues after 2 cycles
            if (nextCycle >= 2) {
              setShowCue(false);
            }
          }
        }, h2 * 1000);
      }
    };
    
    advance();
    
    return () => clearTimeout(timer);
  }, [phase, cycleStage, cycle, currentCycle, totalCycles, pickWord, reflectionId, primary, zoneName, invokedWords.length]);

  // Breathe outro (3s fade)
  useEffect(() => {
    if (phase === 'breathe_outro') {
      console.log('[BreathingSequence] 🌅 Breathe outro');
      
      // Fade audio
      if (audioRef.current) {
        const fadeOut = setInterval(() => {
          if (audioRef.current && audioRef.current.volume > 0.05) {
            audioRef.current.volume -= 0.05;
          } else {
            clearInterval(fadeOut);
            audioRef.current?.pause();
          }
        }, 100);
      }
      
      // Telemetry
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('breathe_ended', {
            detail: { rid: reflectionId, primary, tower: zoneName, cycles: totalCycles },
          })
        );
      }
      
      const timer = setTimeout(() => {
        setPhase('complete');
        onComplete();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, reflectionId, primary, zoneName, totalCycles, onComplete]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Get light intensity based on stage
  const getLightIntensity = () => {
    const [min, max] = light.intensity;
    
    if (cycleStage === 'inhale') {
      return max; // Brighten on inhale
    } else if (cycleStage === 'exhale') {
      return min; // Dim on exhale
    } else {
      return (min + max) / 2; // Hold steady
    }
  };

  const lightIntensity = phase === 'breathe_loop' ? getLightIntensity() : light.intensity[1];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-[#1a0b2e] via-[#2d1b4e] to-[#1a0b2e]">
      {/* Neon tower name reveal */}
      <AnimatePresence>
        {phase === 'neon_reveal' && (
          <motion.div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.h1
              className="text-8xl font-serif italic tracking-wider"
              style={{
                color: zoneColor,
                textShadow: `0 0 20px ${zoneColor}, 0 0 40px ${zoneColor}, 0 0 60px ${zoneColor}`,
              }}
              animate={{
                textShadow: [
                  `0 0 20px ${zoneColor}, 0 0 40px ${zoneColor}, 0 0 60px ${zoneColor}`,
                  `0 0 30px ${zoneColor}, 0 0 60px ${zoneColor}, 0 0 90px ${zoneColor}`,
                  `0 0 20px ${zoneColor}, 0 0 40px ${zoneColor}, 0 0 60px ${zoneColor}`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {zoneName}
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breathing halo (animated based on cycle stage) */}
      {(phase === 'breathe_init' || phase === 'breathe_loop' || phase === 'breathe_outro') && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${color}${Math.round(lightIntensity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
            filter: light.jitter
              ? 'blur(40px) brightness(1.2)'
              : light.strobe
              ? 'blur(30px) brightness(1.5)'
              : 'blur(50px)',
          }}
          animate={{
            scale:
              cycleStage === 'inhale'
                ? [1, 1.3]
                : cycleStage === 'exhale'
                ? [1.3, 0.9]
                : cycleStage === 'hold1'
                ? 1.3
                : 0.9,
            opacity: phase === 'breathe_outro' ? [lightIntensity, 0.3] : lightIntensity,
          }}
          transition={{
            scale: {
              duration:
                cycleStage === 'inhale'
                  ? cycle.in
                  : cycleStage === 'exhale'
                  ? cycle.out
                  : cycleStage === 'hold1'
                  ? cycle.h1
                  : cycle.h2,
              ease: 'easeInOut',
            },
            opacity: {
              duration: phase === 'breathe_outro' ? 3 : 0.5,
            },
          }}
        />
      )}

      {/* Breathing cues (first 2 cycles only) */}
      <AnimatePresence>
        {phase === 'breathe_loop' && showCue && (
          <motion.div
            key={cycleStage}
            className="absolute bottom-1/3 left-1/2 -translate-x-1/2 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0.5], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <p className="text-2xl font-serif italic text-white/70">
              {cycleStage === 'inhale' && 'inhale . . .'}
              {cycleStage === 'exhale' && 'exhale . . .'}
              {cycleStage === 'hold1' && currentCycle === 1 && 'breathe with it'}
            </p>
            <p className="text-sm text-white/40 mt-2">{cueHint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating invoked word */}
      <AnimatePresence>
        {currentWord && (
          <motion.div
            key={currentWord}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, WORD_DRIFT_PX[primary] || 0],
            }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            <span
              className="text-4xl font-serif italic"
              style={{
                color,
                textShadow: `0 0 10px ${color}`,
              }}
            >
              {currentWord}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cycle progress indicator (subtle) */}
      {phase === 'breathe_loop' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: totalCycles }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < currentCycle ? color : 'rgba(255,255,255,0.2)',
                boxShadow: i === currentCycle ? `0 0 8px ${color}` : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

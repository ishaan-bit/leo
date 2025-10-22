'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  type PrimaryEmotion,
  computeBreatheParams,
  FALLBACK_WORDS,
  WORD_DRIFT_PX,
} from '@/lib/breathe-config';
import { getZone } from '@/lib/zones';

interface BreathingSequenceProps {
  reflectionId: string;
  primary: PrimaryEmotion;
  secondary?: string;
  zoneName: string;
  zoneColor: string;
  invokedWords?: string[];
  onComplete: () => void;
}

type BreathePhase = 'neon_reveal' | 'breathe_loop' | 'breathe_outro' | 'complete';
type CycleStage = 'inhale' | 'hold1' | 'exhale' | 'hold2';

// Emotional towers (same as CityInterlude)
const TOWERS = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 180 },
  { id: 'powerful', name: 'Vanta', color: '#FF6B35', x: 25, height: 220 },
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 40, height: 160 },
  { id: 'sad', name: 'Ashmere', color: '#7D8597', x: 55, height: 200 },
  { id: 'mad', name: 'Vire', color: '#C1121F', x: 70, height: 190 },
  { id: 'scared', name: 'Sable', color: '#5A189A', x: 85, height: 170 },
];

// Minimum cycles before allowing completion (even if Stage-2 finishes early)
const MIN_CYCLES_REQUIRED = 3;

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
  const [floatingWords, setFloatingWords] = useState<Array<{ id: string; text: string; x: number }>>([]);
  const [stage2Complete, setStage2Complete] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordPoolRef = useRef<string[]>([]);
  const cycleCountRef = useRef(0);
  
  // Compute breathing parameters
  const breatheParams = computeBreatheParams(primary, secondary);
  const { cycle, light, color, audio } = breatheParams;
  
  // Get primary tower data
  const primaryTower = TOWERS.find(t => t.id === primary) || TOWERS[0];

  // Poll for Stage-2 enrichment completion
  useEffect(() => {
    if (phase !== 'breathe_loop') return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) return;
        
        const reflection = await response.json();
        const status = reflection.status || reflection.final?.status;
        
        console.log('[BreathingSequence] Stage-2 poll:', { status, hasFinal: !!reflection.final, currentCycle: cycleCountRef.current });
        
        // Only complete if BOTH conditions met:
        // 1. Stage-2 enrichment complete
        // 2. Minimum cycles (3) completed
        if (status === 'complete' && cycleCountRef.current >= MIN_CYCLES_REQUIRED) {
          console.log('[BreathingSequence] 🎨 Stage-2 complete + minimum cycles met, ending breathing loop');
          setStage2Complete(true);
          clearInterval(pollInterval);
          setPhase('breathe_outro');
        } else if (status === 'complete' && cycleCountRef.current < MIN_CYCLES_REQUIRED) {
          console.log('[BreathingSequence] ⏳ Stage-2 complete but waiting for minimum cycles:', cycleCountRef.current, '/', MIN_CYCLES_REQUIRED);
          setStage2Complete(true); // Mark complete but keep breathing
        }
      } catch (error) {
        console.error('[BreathingSequence] Poll error:', error);
      }
    }, 2000); // Poll every 2s
    
    return () => clearInterval(pollInterval);
  }, [phase, reflectionId]);

  // Initialize word pool from reflection data
  useEffect(() => {
    const initializeWordPool = async () => {
      try {
        // Fetch full reflection to get expressed, invoked, raw_text
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) throw new Error('Failed to fetch reflection');
        
        const reflection = await response.json();
        
        // Build word pool from multiple sources
        const pool: string[] = [];
        
        // 1. Invoked terms (primary source)
        if (invokedWords.length > 0) {
          pool.push(...invokedWords);
        }
        
        // 2. Expressed emotions
        if (reflection.final?.expressed && reflection.final.expressed !== 'null') {
          const expressed = reflection.final.expressed.split(/[+\s]+/).map((w: string) => w.trim()).filter(Boolean);
          pool.push(...expressed);
        }
        
        // 3. Primary, secondary, tertiary
        if (reflection.final?.wheel?.primary) pool.push(reflection.final.wheel.primary);
        if (reflection.final?.wheel?.secondary) pool.push(reflection.final.wheel.secondary);
        if (reflection.final?.wheel?.tertiary) pool.push(reflection.final.wheel.tertiary);
        
        // 4. Moment from raw_text (first 3 words)
        if (reflection.raw_text) {
          const words = reflection.raw_text.split(/\s+/).slice(0, 3);
          pool.push(...words);
        }
        
        // Fallback if nothing found
        const finalPool = pool.length > 0 ? pool : FALLBACK_WORDS;
        wordPoolRef.current = [...finalPool];
        
        console.log('[BreathingSequence] Word pool initialized:', {
          sources: {
            invoked: invokedWords.length,
            expressed: reflection.final?.expressed?.split('+').length || 0,
            wheel: [primary, secondary].filter(Boolean).length,
            rawText: reflection.raw_text ? 3 : 0,
          },
          totalWords: wordPoolRef.current.length,
          preview: wordPoolRef.current.slice(0, 5),
        });
      } catch (error) {
        console.error('[BreathingSequence] Failed to initialize word pool:', error);
        wordPoolRef.current = [...FALLBACK_WORDS];
      }
    };
    
    initializeWordPool();
  }, [reflectionId, invokedWords, primary, secondary]);

  // Neon reveal phase (3s)
  useEffect(() => {
    if (phase === 'neon_reveal') {
      console.log('[BreathingSequence] 🌟 Neon reveal starting for', zoneName);
      
      // Load and play audio immediately
      if (typeof window !== 'undefined' && audio) {
        const audioEl = new Audio(audio);
        audioEl.loop = true;
        audioEl.volume = 0.6;
        audioEl.play().catch((err) => console.warn('[BreathingSequence] Audio play failed:', err));
        audioRef.current = audioEl;
      }
      
      // Telemetry
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('breathe_loop_active', {
            detail: { rid: reflectionId, primary, tower: zoneName, timestamp: new Date().toISOString() },
          })
        );
      }
      
      const timer = setTimeout(() => {
        setPhase('breathe_loop');
        setCycleStage('inhale');
        setCurrentCycle(0);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, reflectionId, primary, zoneName, audio]);

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

  // Add floating word helper
  const addFloatingWord = useCallback(() => {
    const word = pickWord();
    const wordId = `word-${Date.now()}-${Math.random()}`;
    const xPosition = 40 + Math.random() * 20; // 40-60% from left (near center)
    
    setFloatingWords(prev => [...prev, { id: wordId, text: word, x: xPosition }]);
    
    // Telemetry
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('word_invoked', {
          detail: {
            rid: reflectionId,
            word,
            cycle: cycleCountRef.current,
            source: invokedWords.length > 0 ? 'semantic' : 'fallback',
          },
        })
      );
    }
    
    // Remove word after drift animation completes
    setTimeout(() => {
      setFloatingWords(prev => prev.filter(w => w.id !== wordId));
    }, 4500); // Match animation duration
  }, [pickWord, reflectionId, invokedWords.length]);

  // Continuous breathing loop (no fixed total cycles - runs until Stage-2 complete + minimum cycles)
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
        timer = setTimeout(() => setCycleStage('hold2'), exhale * 1000);
      } else if (cycleStage === 'hold2') {
        timer = setTimeout(() => {
          cycleCountRef.current += 1;
          setCurrentCycle(cycleCountRef.current);
          
          console.log('[BreathingSequence] 🫁 Cycle', cycleCountRef.current, 'complete');
          
          // Check if we can complete now (Stage-2 done + minimum cycles met)
          if (stage2Complete && cycleCountRef.current >= MIN_CYCLES_REQUIRED) {
            console.log('[BreathingSequence] ✅ Minimum cycles complete, transitioning to outro');
            setPhase('breathe_outro');
          } else {
            // Continue breathing
            setCycleStage('inhale');
          }
        }, h2 * 1000);
      }
    };
    
    advance();
    
    return () => clearTimeout(timer);
  }, [phase, cycleStage, cycle, stage2Complete]);

  // Continuous word floating (every 4-5 seconds during breathe_loop to avoid overlap)
  useEffect(() => {
    if (phase !== 'breathe_loop') return;
    
    // Add first word immediately
    addFloatingWord();
    
    const wordInterval = setInterval(() => {
      addFloatingWord();
    }, 4000 + Math.random() * 1000); // 4-5 seconds (matches word duration)
    
    return () => clearInterval(wordInterval);
  }, [phase, addFloatingWord]);

  // Breathe outro (3s fade)
  useEffect(() => {
    if (phase === 'breathe_outro') {
      console.log('[BreathingSequence] 🌅 Breathe outro, Stage-2 complete');
      
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
            detail: { rid: reflectionId, primary, tower: zoneName, cycles: cycleCountRef.current },
          })
        );
      }
      
      const timer = setTimeout(() => {
        setPhase('complete');
        onComplete();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, reflectionId, primary, zoneName, onComplete]);

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

  const lightIntensity = phase === 'breathe_loop' ? getLightIntensity() : (phase === 'breathe_outro' ? 0.3 : 1);
  
  // Get breathing scale based on cycle stage
  const getBreathingScale = () => {
    if (phase !== 'breathe_loop') return 1;
    
    if (cycleStage === 'inhale') return 1.15; // Expand
    if (cycleStage === 'exhale') return 0.92; // Contract
    if (cycleStage === 'hold1') return 1.15; // Hold expanded
    return 0.92; // hold2 - Hold contracted
  };

  // Visual state helpers - group holds with their preceding action
  const isInhalePhase = cycleStage === 'inhale' || cycleStage === 'hold1';
  const isExhalePhase = cycleStage === 'exhale' || cycleStage === 'hold2';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Sky background - breathes with cycle (brighter on inhale+hold1, dimmer on exhale+hold2) */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: phase === 'breathe_loop'
            ? (isInhalePhase
                ? 'linear-gradient(to bottom, #1A1734, #3B3367, #1A1734)' // Brighter
                : 'linear-gradient(to bottom, #0A0714, #2B2357, #0A0714)') // Dimmer
            : 'linear-gradient(to bottom, #0A0714, #2B2357, #0A0714)',
        }}
        transition={{
          duration: cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.5,
          ease: [0.42, 0, 0.58, 1], // easeInOutSine
        }}
      />
      
      {/* Stars - pulse with breathing (bright during inhale+hold1, dim during exhale+hold2) */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 120 }).map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80}%`,
            }}
            animate={{
              opacity: phase === 'breathe_loop'
                ? (isInhalePhase ? 0.9 : 0.2)
                : [0.2, 0.8, 0.2],
              scale: phase === 'breathe_loop'
                ? (isInhalePhase ? 1.3 : 1)
                : [1, 1.2, 1],
            }}
            transition={{
              duration: phase === 'breathe_loop'
                ? (cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.3)
                : 2 + Math.random() * 3,
              repeat: phase === 'breathe_loop' ? 0 : Infinity,
              delay: phase === 'breathe_loop' ? 0 : Math.random() * 5,
              ease: [0.42, 0, 0.58, 1], // easeInOutSine
            }}
          />
        ))}
      </div>

      {/* Leo - breathing animation (expand during inhale+hold1, contract during exhale+hold2) */}
      <motion.div
        className="absolute z-20"
        style={{
          left: '50%',
          top: '35%',
        }}
        initial={{ x: '-50%', y: '-50%' }}
        animate={{
          x: '-50%',
          y: '-50%',
        }}
      >
        <motion.div
          animate={{
            scale: phase === 'breathe_loop'
              ? getBreathingScale() // 1.15 for inhale+hold1, 0.92 for exhale+hold2
              : 1,
            rotate: [-2, 2, -2],
          }}
          transition={{
            scale: {
              duration: cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.3,
              ease: [0.42, 0, 0.58, 1], // easeInOutSine
            },
            rotate: {
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
          style={{
            width: '200px',
            height: '200px',
          }}
        >
          <Image
            src="/images/leo.svg"
            alt="Leo"
            width={200}
            height={200}
            priority
          />
        </motion.div>
      </motion.div>

      {/* Breathing prompts - show inhale during inhale+hold1, exhale during exhale+hold2 */}
      <AnimatePresence mode="wait">
        {phase === 'breathe_loop' && (
          <motion.div
            key={isInhalePhase ? 'inhale' : 'exhale'}
            className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            style={{
              top: 'calc(35% + 130px)', // Below Leo
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 0.9,
              scale: isInhalePhase ? 1.05 : 0.95,
            }}
            exit={{ 
              opacity: 0,
              scale: 0.9,
            }}
            transition={{ 
              duration: 0.5,
              ease: [0.42, 0, 0.58, 1], // easeInOutSine
            }}
          >
            <div
              className="text-3xl md:text-4xl font-sans tracking-wide"
              style={{
                color: zoneColor,
                textShadow: `
                  0 0 15px ${zoneColor},
                  0 0 30px ${zoneColor}60,
                  0 2px 4px rgba(0,0,0,0.3)
                `,
                fontWeight: 300,
                letterSpacing: '0.3em',
                textTransform: 'lowercase',
              }}
            >
              {isInhalePhase ? 'inhale' : 'exhale'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* City skyline with six towers (primary centered, others faded) */}
      {/* Inherit CityInterlude zoom end state (scale:2.5, y:-30%), then smoothly zoom out during neon_reveal */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-25"
        style={{ height: '50vh' }}
        initial={{ scale: 2.5, y: '-30%' }}
        animate={
          phase === 'neon_reveal'
            ? { scale: 1, y: 0 } // Smooth zoom out during 3s neon reveal
            : { scale: 1, y: 0 } // Stay normal during breathe_loop
        }
        transition={{
          duration: phase === 'neon_reveal' ? 3 : 0,
          ease: [0.22, 1, 0.36, 1], // easeOutCubic (match CityInterlude)
        }}
      >
        {TOWERS.map((tower, idx) => {
          const isPrimary = tower.id === primary;
          const towerOpacity = isPrimary ? 1 : 0.2; // Fade non-primary towers
          
          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${tower.x}%`,
                width: '80px',
                height: `${tower.height * 1.8}px`,
              }}
              animate={{
                opacity: phase === 'breathe_loop'
                  ? (isInhalePhase ? towerOpacity * 1.1 : towerOpacity * 0.8)
                  : towerOpacity,
                scale: phase === 'breathe_loop' && isPrimary
                  ? (isInhalePhase ? 1.02 : 0.98)
                  : 1,
              }}
              transition={{
                opacity: { 
                  duration: cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.5,
                  ease: [0.42, 0, 0.58, 1],
                },
                scale: {
                  duration: cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.5,
                  ease: [0.42, 0, 0.58, 1], // easeInOutSine
                },
              }}
            >
              {/* Tower silhouette */}
              <motion.div
                className="w-full h-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  border: `1px solid ${tower.color}40`,
                  borderRadius: '2px 2px 0 0',
                }}
                animate={{
                  boxShadow: isPrimary 
                    ? [
                        `0 0 ${40 * lightIntensity}px ${tower.color}${Math.round(lightIntensity * 100).toString(16).padStart(2, '0')}`,
                        `0 0 ${70 * lightIntensity}px ${tower.color}${Math.round(lightIntensity * 128).toString(16).padStart(2, '0')}`,
                        `0 0 ${40 * lightIntensity}px ${tower.color}${Math.round(lightIntensity * 100).toString(16).padStart(2, '0')}`,
                      ]
                    : `0 0 20px ${tower.color}20`,
                }}
                transition={{
                  boxShadow: {
                    duration: phase === 'breathe_loop' ? (cycle.in + cycle.out) : 2,
                    repeat: Infinity,
                    ease: [0.45, 0.05, 0.55, 0.95],
                  },
                }}
              >
                {/* Windows grid - keep pulsing for all towers */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.floor((tower.height * 1.8) / 25) * 4 }).map((_, i) => {
                    const breathPattern = Math.random();
                    const baseDelay = i * 0.15;
                    const cycleDuration = 2.5 + breathPattern * 3.5;
                    const minOpacity = (isPrimary ? 0.15 : 0.08) + breathPattern * 0.1;
                    const maxOpacity = (isPrimary ? 0.6 : 0.25) + breathPattern * 0.2;
                    
                    return (
                      <motion.div
                        key={`window-${tower.id}-${i}`}
                        className="bg-white/0 rounded-[1px]"
                        animate={{
                          backgroundColor: [
                            `rgba(248, 216, 181, ${towerOpacity * minOpacity})`,
                            `rgba(255, 230, 200, ${towerOpacity * maxOpacity})`,
                            `rgba(248, 216, 181, ${towerOpacity * minOpacity})`,
                          ],
                        }}
                        transition={{
                          duration: cycleDuration,
                          repeat: Infinity,
                          delay: baseDelay,
                          ease: [0.45, 0.05, 0.55, 0.95],
                        }}
                      />
                    );
                  })}
                </div>

                {/* Neon tower name - persistent, only opacity animates */}
                {/* Building name (e.g., "Haven", "Ashmere") remains throughout */}
                {isPrimary && (
                  <motion.div
                    className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-3xl z-30"
                    style={{ 
                      color: tower.color,
                      textShadow: `
                        0 0 40px ${tower.color},
                        0 0 80px ${tower.color},
                        0 0 120px ${tower.color}80,
                        0 2px 4px rgba(0,0,0,0.5)
                      `,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{
                      textShadow: phase === 'neon_reveal' 
                        ? [
                            `0 0 0px ${tower.color}, 0 0 0px ${tower.color}`,
                            `0 0 60px ${tower.color}, 0 0 120px ${tower.color}`,
                            `0 0 40px ${tower.color}, 0 0 80px ${tower.color}`,
                            `0 0 60px ${tower.color}, 0 0 120px ${tower.color}`,
                            `0 0 50px ${tower.color}, 0 0 100px ${tower.color}`,
                            `0 0 60px ${tower.color}, 0 0 120px ${tower.color}`,
                          ]
                        : [ // Breathe with breathing rhythm
                            `0 0 ${40 * lightIntensity}px ${tower.color}, 0 0 ${80 * lightIntensity}px ${tower.color}`,
                            `0 0 ${60 * lightIntensity}px ${tower.color}, 0 0 ${120 * lightIntensity}px ${tower.color}`,
                            `0 0 ${40 * lightIntensity}px ${tower.color}, 0 0 ${80 * lightIntensity}px ${tower.color}`,
                          ],
                      opacity: phase === 'neon_reveal' 
                        ? [0, 1, 0.9, 1, 0.95, 1] // Enter-the-Void flicker
                        : 1, // Always visible during breathe_loop (no remount)
                    }}
                    transition={{
                      textShadow: {
                        duration: phase === 'neon_reveal' ? 2.5 : (cycle.in + cycle.out),
                        times: phase === 'neon_reveal' ? [0, 0.25, 0.4, 0.6, 0.8, 1] : undefined,
                        repeat: phase === 'neon_reveal' ? 0 : Infinity,
                        ease: [0.42, 0, 0.58, 1], // easeInOutSine
                      },
                      opacity: {
                        duration: phase === 'neon_reveal' ? 2.5 : 0,
                        times: phase === 'neon_reveal' ? [0, 0.25, 0.4, 0.6, 0.8, 1] : undefined,
                      },
                    }}
                  >
                    {zoneName}
                  </motion.div>
                )}

                {/* Breathing halo - expand during inhale+hold1, contract during exhale+hold2 */}
                {isPrimary && phase !== 'neon_reveal' && (
                  <motion.div
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none z-29"
                    style={{
                      background: `radial-gradient(circle, ${tower.color}${Math.round(lightIntensity * 102).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                    animate={{
                      scale: isInhalePhase ? 1.4 : 0.8,
                      opacity: phase === 'breathe_outro' ? 0.2 : lightIntensity,
                    }}
                    transition={{
                      scale: {
                        duration: cycleStage === 'inhale' ? cycle.in : cycleStage === 'exhale' ? cycle.out : 0.3,
                        ease: [0.42, 0, 0.58, 1], // easeInOutSine
                      },
                      opacity: {
                        duration: phase === 'breathe_outro' ? 3 : 0.5,
                        ease: [0.42, 0, 0.58, 1],
                      },
                    }}
                  />
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Floating semantic words - gentle pulse around Leo */}
      {/* Fade-in (1s), hold (2s), fade-out (1s), random staggering */}
      <AnimatePresence>
        {floatingWords.map((word) => {
          const driftY = (WORD_DRIFT_PX[primary] || -20) * 0.5; // Reduced drift
          const driftX = (Math.random() - 0.5) * 30;
          // Position around Leo (35% top) in a circle pattern
          const angle = Math.random() * Math.PI * 2;
          const radius = 150 + Math.random() * 50; // 150-200px from Leo center
          const startX = 50 + (Math.cos(angle) * radius) / 10; // Percentage offset from center
          const startY = 35 + (Math.sin(angle) * radius) / 10; // Percentage offset from Leo Y
          
          return (
            <motion.div
              key={word.id}
              className="absolute pointer-events-none z-40"
              style={{
                left: `${startX}%`,
                top: `${startY}%`,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                // Fade-in (1s, 0-0.2), hold (2.5s, 0.2-0.75), fade-out (1s, 0.75-1.0)
                opacity: [0, 0.85, 0.9, 0.9, 0.85, 0],
                scale: [0.8, 1, 1.05, 1.05, 1, 0.9],
                x: driftX,
                y: driftY,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                duration: 4.5, // Total: 1s fade-in + 2.5s hold + 1s fade-out
                ease: [0.42, 0, 0.58, 1], // easeInOutSine
                opacity: { 
                  times: [0, 0.22, 0.35, 0.65, 0.78, 1], // Clearer hold period
                  ease: [0.42, 0, 0.58, 1],
                },
                scale: { 
                  times: [0, 0.22, 0.35, 0.65, 0.78, 1],
                  ease: [0.42, 0, 0.58, 1],
                },
              }}
            >
              <motion.span
                className="text-2xl md:text-3xl font-serif italic"
                style={{
                  color: zoneColor,
                  textShadow: `
                    0 0 12px ${zoneColor},
                    0 0 24px ${zoneColor}80,
                    0 0 36px ${zoneColor}40
                  `,
                }}
                animate={{
                  textShadow: phase === 'breathe_loop'
                    ? [
                        `0 0 8px ${zoneColor}, 0 0 16px ${zoneColor}80, 0 0 24px ${zoneColor}40`,
                        `0 0 16px ${zoneColor}, 0 0 32px ${zoneColor}80, 0 0 48px ${zoneColor}40`,
                        `0 0 8px ${zoneColor}, 0 0 16px ${zoneColor}80, 0 0 24px ${zoneColor}40`,
                      ]
                    : `0 0 12px ${zoneColor}, 0 0 24px ${zoneColor}80, 0 0 36px ${zoneColor}40`,
                }}
                transition={{
                  textShadow: {
                    duration: phase === 'breathe_loop' ? (cycle.in + cycle.out) : 3,
                    repeat: Infinity,
                    ease: [0.42, 0, 0.58, 1],
                  },
                }}
              >
                {word.text}
              </motion.span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Cycle counter (bottom center, subtle) */}
      {phase === 'breathe_loop' && currentCycle > 0 && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
        >
          cycle {currentCycle}
        </motion.div>
      )}

      {/* Stage-2 loading indicator (if still waiting after 10+ cycles) */}
      {phase === 'breathe_loop' && currentCycle > 10 && !stage2Complete && (
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 text-white/40 text-xs italic"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          enriching your moment...
        </motion.div>
      )}
    </div>
  );
}

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
        
        console.log('[BreathingSequence] Stage-2 poll:', { status, hasFinal: !!reflection.final });
        
        if (status === 'complete') {
          console.log('[BreathingSequence] 🎨 Stage-2 complete, ending breathing loop');
          setStage2Complete(true);
          clearInterval(pollInterval);
          setPhase('breathe_outro');
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
    }, 3000);
  }, [pickWord, reflectionId, invokedWords.length]);

  // Continuous breathing loop (no fixed total cycles - runs until Stage-2 complete)
  useEffect(() => {
    if (phase !== 'breathe_loop') return;
    
    const { in: inhale, h1, out: exhale, h2 } = cycle;
    let timer: NodeJS.Timeout;
    
    const advance = () => {
      if (cycleStage === 'inhale') {
        timer = setTimeout(() => setCycleStage('hold1'), inhale * 1000);
      } else if (cycleStage === 'hold1') {
        // Occasionally add word mid-inhale (1 in 5 chance)
        if (Math.random() < 0.2) {
          addFloatingWord();
        }
        timer = setTimeout(() => setCycleStage('exhale'), h1 * 1000);
      } else if (cycleStage === 'exhale') {
        timer = setTimeout(() => {
          setCycleStage('hold2');
          
          // Always add word on exhale end
          addFloatingWord();
        }, exhale * 1000);
      } else if (cycleStage === 'hold2') {
        timer = setTimeout(() => {
          cycleCountRef.current += 1;
          setCurrentCycle(cycleCountRef.current);
          setCycleStage('inhale');
          
          console.log('[BreathingSequence] 🫁 Cycle', cycleCountRef.current, 'complete');
        }, h2 * 1000);
      }
    };
    
    advance();
    
    return () => clearTimeout(timer);
  }, [phase, cycleStage, cycle, addFloatingWord]);

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
  const baseWindowPulse = 0.4 + Math.sin(Date.now() / 2000) * 0.2; // Continuous city pulse

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-[#0A0714] via-[#2B2357] to-[#0A0714]">
      {/* Stars (from CityInterlude) */}
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
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* Leo - hovering above primary tower, gentle breathing */}
      <motion.div
        className="absolute z-20"
        style={{
          left: '50%',
          top: '35%',
        }}
        initial={{ x: '-50%', y: '-50%' }}
        animate={{
          x: '-50%',
          y: ['-50%', '-55%', '-50%'], // Gentle vertical bob with breathing
        }}
        transition={{
          y: { 
            duration: (cycle.in + cycle.h1 + cycle.out + cycle.h2), 
            repeat: Infinity, 
            ease: [0.45, 0.05, 0.55, 0.95] 
          },
        }}
      >
        <motion.div
          animate={{
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
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

      {/* City skyline with six towers (primary centered, others faded) */}
      <div className="absolute bottom-0 left-0 right-0 z-25" style={{ height: '50vh' }}>
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
                opacity: towerOpacity,
              }}
              transition={{
                opacity: { duration: 1.5, ease: 'easeOut' },
              }}
            >
              {/* Tower silhouette */}
              <div
                className="w-full h-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  boxShadow: isPrimary 
                    ? `0 0 60px ${tower.color}${Math.round(lightIntensity * 128).toString(16).padStart(2, '0')}`
                    : `0 0 20px ${tower.color}20`,
                  border: `1px solid ${tower.color}40`,
                  borderRadius: '2px 2px 0 0',
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

                {/* Neon tower name - anchored above roof, flickers with breathing */}
                {isPrimary && (
                  <motion.div
                    className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-3xl z-30"
                    style={{ 
                      color: tower.color, 
                      textShadow: `0 0 20px ${tower.color}, 0 0 40px ${tower.color}` 
                    }}
                    animate={{
                      textShadow: [
                        `0 0 ${20 * lightIntensity}px ${tower.color}, 0 0 ${40 * lightIntensity}px ${tower.color}`,
                        `0 0 ${30 * lightIntensity}px ${tower.color}, 0 0 ${60 * lightIntensity}px ${tower.color}`,
                        `0 0 ${20 * lightIntensity}px ${tower.color}, 0 0 ${40 * lightIntensity}px ${tower.color}`,
                      ],
                      opacity: phase === 'neon_reveal' 
                        ? [0, 1, 0.9, 1, 0.95, 1] // Enter-the-Void style flicker
                        : [0.9, 1, 0.9], // Subtle pulse with breathing
                    }}
                    transition={{
                      textShadow: {
                        duration: cycle.in + cycle.out,
                        repeat: Infinity,
                        ease: [0.45, 0.05, 0.55, 0.95],
                      },
                      opacity: phase === 'neon_reveal'
                        ? { duration: 2, times: [0, 0.3, 0.4, 0.6, 0.8, 1] }
                        : { duration: 2, repeat: Infinity },
                    }}
                  >
                    {tower.name}
                  </motion.div>
                )}

                {/* Breathing halo - anchored above tower roof */}
                {isPrimary && phase !== 'neon_reveal' && (
                  <motion.div
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none z-29"
                    style={{
                      background: `radial-gradient(circle, ${tower.color}${Math.round(lightIntensity * 102).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                    animate={{
                      scale:
                        cycleStage === 'inhale'
                          ? [1, 1.4]
                          : cycleStage === 'exhale'
                          ? [1.4, 0.8]
                          : cycleStage === 'hold1'
                          ? 1.4
                          : 0.8,
                      opacity: phase === 'breathe_outro' ? [lightIntensity, 0.2] : [lightIntensity * 0.8, lightIntensity, lightIntensity * 0.8],
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
                        ease: [0.45, 0.05, 0.55, 0.95],
                      },
                      opacity: {
                        duration: phase === 'breathe_outro' ? 3 : 2,
                        repeat: phase === 'breathe_outro' ? 0 : Infinity,
                      },
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating semantic words - continuous drift between cycles */}
      <AnimatePresence>
        {floatingWords.map((word) => {
          const driftY = WORD_DRIFT_PX[primary] || -20;
          const driftX = (Math.random() - 0.5) * 30; // Small horizontal drift
          
          return (
            <motion.div
              key={word.id}
              className="absolute pointer-events-none z-40"
              style={{
                left: `${word.x}%`,
                top: '45%',
              }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 0.7, 0.7, 0],
                x: driftX,
                y: driftY,
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 3, 
                ease: 'easeOut',
                opacity: { times: [0, 0.2, 0.7, 1] }
              }}
            >
              <span
                className="text-2xl md:text-3xl font-serif italic"
                style={{
                  color: zoneColor,
                  textShadow: `0 0 8px ${zoneColor}80`,
                }}
              >
                {word.text}
              </span>
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

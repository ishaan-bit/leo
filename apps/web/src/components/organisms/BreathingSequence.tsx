'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { type PrimaryEmotion, computeBreatheParams, FALLBACK_WORDS } from '@/lib/breathe-config';
import type { Stage2State, PostEnrichmentPayload, Stage2Phase, WindowState } from '@/lib/stage2-types';
import ComicBubble from '../atoms/ComicBubble';
import { translateToHindi } from '@/lib/translation';

interface BreathingSequenceProps {
  reflectionId: string;
  primary: PrimaryEmotion | null; // null = no emotion detected, use Peaceful pattern
  secondary?: string;
  zoneName: string;
  zoneColor: string;
  invokedWords?: string[];
  pigName?: string; // For Stage 2 closing cue
  onComplete: () => void;
}

// Emotional towers - repositioned for breathing sequence
// Primary tower positioned at 35% (center-left) for visibility
// MAPPING: joyful?Vera, powerful?Ashmere, peaceful?Haven, sad?Vanta, scared?Vire, mad?Sable
// COLORS MATCH Living City tower configs for visual continuity
const TOWERS = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 180 },      // Gold - Joy
  { id: 'powerful', name: 'Ashmere', color: '#FF6B35', x: 25, height: 220 }, // Orange - Power
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 40, height: 160 },   // Blue - Peace
  { id: 'sad', name: 'Vanta', color: '#7D8597', x: 55, height: 200 },        // Gray - Sadness
  { id: 'scared', name: 'Vire', color: '#5A189A', x: 70, height: 190 },      // Purple - Fear
  { id: 'mad', name: 'Sable', color: '#C1121F', x: 85, height: 170 },        // Red - Anger
];

// Get repositioned X for primary tower (center-left at 35%)
const getPrimaryTowerX = (towerId: string) => {
  return 35; // Center-left position
};

const MIN_CYCLES = 3;
const EASING = [0.42, 0, 0.58, 1] as const; // easeInOutSine

export default function BreathingSequence({
  reflectionId,
  primary,
  secondary,
  zoneName,
  zoneColor,
  invokedWords = [],
  pigName = 'Leo',
  onComplete,
}: BreathingSequenceProps) {
  const [breathProgress, setBreathProgress] = useState(0); // 0-1 continuous
  const [cycleCount, setCycleCount] = useState(0);
  const [floatingPoem, setFloatingPoem] = useState<{ id: string; text: string } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [stage2Complete, setStage2Complete] = useState(false);
  
  // NEW ARCHITECTURE: Poems float as complete lines, tips from Leo only
  type BubbleSequenceStep = 
    | 'idle' 
    | 'poem1_floating' | 'tip1' | 'mark_done_1'
    | 'poem2_floating' | 'tip2' | 'mark_done_2'
    | 'poem3_floating' | 'tip3' | 'mark_done_3'
    | 'sky' | 'gradientReturn';
  
  const [bubbleStep, setBubbleStep] = useState<BubbleSequenceStep>('idle');
  const [leoBubbleState, setLeoBubbleState] = useState<'hidden' | 'text' | 'ellipsis'>('hidden');
  const [skyLightnessLevel, setSkyLightnessLevel] = useState(0); // 0-4
  const [leoReacting, setLeoReacting] = useState(false); // For tip reactions
  
  // "Mark Done" state - tracks which tips have been marked
  const [markedTips, setMarkedTips] = useState<number[]>([]); // [1, 2, 3] as they're marked
  const [currentTipIndex, setCurrentTipIndex] = useState(0); // 0 = tip1, 1 = tip2, 2 = tip3
  const [showMarkDoneButton, setShowMarkDoneButton] = useState(false);
  
  // Stage 2 state (holds poems and tips from enrichment)
  const [stage2Payload, setStage2Payload] = useState<PostEnrichmentPayload | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const leoContainerRef = useRef<HTMLDivElement>(null);
  const buildingContainerRef = useRef<HTMLDivElement>(null);
  const orchestrationStartedRef = useRef(false);
  const breathingContainerRef = useRef<HTMLDivElement>(null);
  
  // When primary is null (no emotion), use Peaceful breathing pattern
  const effectivePrimary = primary || 'peaceful';
  const breatheParams = computeBreatheParams(effectivePrimary as PrimaryEmotion, secondary);
  const { cycle, color, audio } = breatheParams;
  
  // Use normal breathing cycle (orchestrator handles its own timing)
  const activeCycle = cycle;
  const cycleDuration = (activeCycle.in + activeCycle.out) * 1000; // ms
  
  // When primary is null: run 3 cycles then go to orchestrator (skip Stage 2)
  const isNullEmotion = primary === null;
  const targetCycles = isNullEmotion ? 3 : MIN_CYCLES;
  
  const primaryTower = TOWERS.find(t => t.id === effectivePrimary) || TOWERS[0];

  // Start audio and reveal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load audio
    if (audio) {
      const audioEl = new Audio(audio);
      audioEl.loop = true;
      audioEl.volume = 0.6;
      audioEl.play().catch(err => console.warn('[Breathing] Audio play failed:', err));
      audioRef.current = audioEl;
    }
    
    // Reveal delay
    setTimeout(() => setIsReady(true), 2000);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audio]);

  // Poll for Stage-2 enrichment (post_enrichment payload)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) return;
        
        const reflection = await response.json();
        
        // Check for post_enrichment payload
        const postEnrichment = reflection.post_enrichment || reflection.final?.post_enrichment;
        if (postEnrichment && !stage2Payload) {
          console.log('[Stage2] Post-enrichment received:', postEnrichment);
          
          setStage2Payload({
            poems: postEnrichment.poems || [],
            tips: postEnrichment.tips || [],
            closing_line: postEnrichment.closing_line || '',
            tip_moods: postEnrichment.tip_moods || [],
          });
          
          // Trigger Stage 2 sequence
          setStage2Complete(true);
        }
        
        // Backup: Check completion status
        const status = reflection.status || reflection.final?.status;
        if (status === 'complete' && !stage2Complete && !stage2Payload) {
          console.log('[Breathing] Enrichment complete (backup trigger)');
          setStage2Complete(true);
        }
      } catch (error) {
        console.error('[Breathing] Poll error:', error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [reflectionId, stage2Complete, stage2Payload]);

  // Null emotion handling: Complete after 3 cycles without Stage 2
  useEffect(() => {
    if (!isNullEmotion || !isReady) return;
    
    if (cycleCount >= targetCycles) {
      console.log('[Breathing] 🌙 Null emotion: 3 cycles complete, going to orchestrator');
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
      
      // Skip Stage 2, go directly to orchestrator
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  }, [isNullEmotion, isReady, cycleCount, targetCycles, onComplete]);

  // Continuous breathing animation loop
  useEffect(() => {
    if (!isReady) return;
    
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const cyclePosition = (elapsed % cycleDuration) / cycleDuration;
      
      // 0-0.5 = inhale, 0.5-1 = exhale (simplified, no holds)
      setBreathProgress(cyclePosition);
      
      // Count completed cycles
      const currentCycle = Math.floor(elapsed / cycleDuration);
      if (currentCycle > cycleCount) {
        setCycleCount(currentCycle);
        console.log('[Breathing] Cycle', currentCycle, 'complete');
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isReady, cycleDuration, cycleCount, stage2Complete, onComplete]);

  // NEW ORCHESTRATION: Poem floating → Leo tip → Mark Done (repeat 3x) → Sky → Living City
  useEffect(() => {
    if (!stage2Complete || !stage2Payload) {
      return;
    }
    
    if (orchestrationStartedRef.current) {
      return;
    }
    
    orchestrationStartedRef.current = true;
    console.log('[Bubble Sequence] 🎬 Starting poem-floating sequence');
    
    const poems = stage2Payload.poems || [];
    const tips = stage2Payload.tips || [];
    
    // Cycle 1: Poem 1 floats → Tip 1 from Leo → Mark Done
    setTimeout(() => {
      if (poems[0]) {
        console.log('[Sequence] 📖 Showing poem 1 floating');
        setBubbleStep('poem1_floating');
        setFloatingPoem({ id: 'poem1', text: poems[0] });
        
        // After poem floats away (6s), show tip from Leo
        setTimeout(() => {
          setFloatingPoem(null);
          
          setTimeout(() => {
            if (tips[0]) {
              console.log('[Sequence] 💬 Leo showing tip 1');
              setBubbleStep('tip1');
              setLeoBubbleState('text');
              
              // Leo reacts
              setTimeout(() => {
                setLeoReacting(true);
                setTimeout(() => setLeoReacting(false), 700);
              }, 300);
              
              // Hold tip, then show Mark Done
              setTimeout(() => {
                setLeoBubbleState('ellipsis');
                setTimeout(() => {
                  setLeoBubbleState('hidden');
                  
                  setTimeout(() => {
                    console.log('[Sequence] ✅ Showing Mark Done for tip 1');
                    setBubbleStep('mark_done_1');
                    setCurrentTipIndex(0);
                    setShowMarkDoneButton(true);
                  }, 600);
                }, 600);
              }, 2500);
            }
          }, 800);
        }, 6000);
      }
    }, 500);
  }, [stage2Complete, stage2Payload]);
  
  // Watch for Mark Done clicks and continue sequence
  useEffect(() => {
    if (markedTips.length === 0 || !stage2Payload) return;
    
    const lastMarked = Math.max(...markedTips);
    const poems = stage2Payload.poems || [];
    const tips = stage2Payload.tips || [];
    
    // Tip 1 marked → Poem 2 floats → Tip 2
    if (lastMarked === 1 && markedTips.length === 1) {
      setTimeout(() => {
        if (poems[1]) {
          console.log('[Sequence] 📖 Showing poem 2 floating');
          setBubbleStep('poem2_floating');
          setFloatingPoem({ id: 'poem2', text: poems[1] });
          
          setTimeout(() => {
            setFloatingPoem(null);
            
            setTimeout(() => {
              if (tips[1]) {
                console.log('[Sequence] 💬 Leo showing tip 2');
                setBubbleStep('tip2');
                setLeoBubbleState('text');
                
                setTimeout(() => {
                  setLeoReacting(true);
                  setTimeout(() => setLeoReacting(false), 700);
                }, 300);
                
                setTimeout(() => {
                  setLeoBubbleState('ellipsis');
                  setTimeout(() => {
                    setLeoBubbleState('hidden');
                    
                    setTimeout(() => {
                      console.log('[Sequence] ✅ Showing Mark Done for tip 2');
                      setBubbleStep('mark_done_2');
                      setCurrentTipIndex(1);
                      setShowMarkDoneButton(true);
                    }, 600);
                  }, 600);
                }, 2500);
              }
            }, 800);
          }, 6000);
        }
      }, 1000);
    }
    
    // Tip 2 marked → Poem 3 floats → Tip 3
    else if (lastMarked === 2 && markedTips.length === 2) {
      setTimeout(() => {
        if (poems[2]) {
          console.log('[Sequence] 📖 Showing poem 3 floating');
          setBubbleStep('poem3_floating');
          setFloatingPoem({ id: 'poem3', text: poems[2] });
          
          setTimeout(() => {
            setFloatingPoem(null);
            
            setTimeout(() => {
              if (tips[2]) {
                console.log('[Sequence] 💬 Leo showing tip 3');
                setBubbleStep('tip3');
                setLeoBubbleState('text');
                
                setTimeout(() => {
                  setLeoReacting(true);
                  setTimeout(() => setLeoReacting(false), 700);
                }, 300);
                
                setTimeout(() => {
                  setLeoBubbleState('ellipsis');
                  setTimeout(() => {
                    setLeoBubbleState('hidden');
                    
                    setTimeout(() => {
                      console.log('[Sequence] ✅ Showing Mark Done for tip 3');
                      setBubbleStep('mark_done_3');
                      setCurrentTipIndex(2);
                      setShowMarkDoneButton(true);
                    }, 600);
                  }, 600);
                }, 2500);
              }
            }, 800);
          }, 6000);
        }
      }, 1000);
    }
    
    // Tip 3 marked → Sky brightens → Living City
    else if (lastMarked === 3 && markedTips.length === 3) {
      console.log('[Sequence] 🌅 All tips complete, transitioning to Living City');
      
      setTimeout(() => {
        setBubbleStep('sky');
        setSkyLightnessLevel(3);
        
        setTimeout(() => {
          setBubbleStep('gradientReturn');
          setSkyLightnessLevel(4);
          
          setTimeout(() => {
            console.log('[Sequence] ✅ Transition to Living City');
            onComplete();
          }, 2500);
        }, 2000);
      }, 1000);
    }
  }, [markedTips, stage2Payload, onComplete]);

  // Breathing helpers
  const isInhaling = breathProgress < 0.5;
  const skyBrightness = isInhaling ? 1.2 : 0.8;
  const leoScale = isInhaling ? 1.15 : 0.92;
  const starOpacity = isInhaling ? 0.9 : 0.3;
  
  // Handle "Mark Done" button click - advances to next poem/tip cycle
  const handleMarkDone = (tipIndex: number) => {
    console.log(`[Breathing] 🎯 Mark Done clicked for tip ${tipIndex + 1}`);
    
    // Track this tip as marked
    setMarkedTips(prev => [...prev, tipIndex + 1]);
    setShowMarkDoneButton(false);
    
    // Play success SFX
    const successAudio = new Audio('/sounds/success-chime.mp3');
    successAudio.volume = 0.6;
    successAudio.play().catch(err => console.warn('[Breathing] Success SFX failed:', err));
    
    // Visual feedback - brief pause, then continue to next poem
    setTimeout(() => {
      console.log(`[Breathing] ✅ Tip ${tipIndex + 1} marked, continuing to next poem...`);
      // The orchestrator will handle the next step based on markedTips array
    }, 800);
  };

  // Sky gradient based on lightness level (0 = night, 4 = pink gradient)
  const getSkyGradient = () => {
    switch (skyLightnessLevel) {
      case 0: // Night
        return isInhaling
          ? 'linear-gradient(to bottom, #1A1734, #3B3367, #1A1734)'
          : 'linear-gradient(to bottom, #0A0714, #2B2357, #0A0714)';
      case 1: // Slightly lighter
        return isInhaling
          ? 'linear-gradient(to bottom, #2A2744, #4B4377, #2A2744)'
          : 'linear-gradient(to bottom, #1A1724, #3B3367, #1A1724)';
      case 2: // More light
        return isInhaling
          ? 'linear-gradient(to bottom, #3A3754, #5B5387, #3A3754)'
          : 'linear-gradient(to bottom, #2A2734, #4B4377, #2A2734)';
      case 3: // Pre-dawn
        return isInhaling
          ? 'linear-gradient(to bottom, #4A4764, #6B6397, #4A4764)'
          : 'linear-gradient(to bottom, #3A3744, #5B5387, #3A3744)';
      case 4: // Pink gradient (interlude)
        return 'linear-gradient(to bottom, #FFF5F7, #FFE5E9, #FFF0F3)';
      default:
        return getSkyGradient();
    }
  };

  return (
    <div ref={breathingContainerRef} className="fixed inset-0 z-50 overflow-hidden">
      {/* Sky background with progressive lightening */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: getSkyGradient(),
        }}
        transition={{ duration: skyLightnessLevel >= 1 ? 2 : activeCycle.in, ease: EASING }}
      />
      
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80}%`,
            }}
            animate={{ opacity: starOpacity, scale: isInhaling ? 1.3 : 1 }}
            transition={{ duration: activeCycle.in, ease: EASING }}
          />
        ))}
      </div>

      {/* Leo - centered, breathing */}
      <motion.div
        ref={leoContainerRef}
        id="leoContainer"
        className="absolute z-20 left-1/2 top-[28%]"
        style={{ x: '-50%', y: '-50%' }}
      >
        <motion.div
          animate={{ 
            scale: leoScale,
            // Reaction animation: head tilt + subtle ear wiggle
            rotateZ: leoReacting ? [-1, 1.5, -1, 0] : 0,
          }}
          transition={{ 
            scale: { duration: activeCycle.in, ease: EASING },
            rotateZ: leoReacting 
              ? { duration: 0.7, times: [0, 0.33, 0.66, 1], ease: 'easeInOut' }
              : { duration: 0.3, ease: 'easeOut' }
          }}
        >
          <Image src="/images/leo.svg" alt="Leo" width={200} height={200} priority />
        </motion.div>
      </motion.div>

      {/* Breathing prompt - positioned below Leo */}
      {/* Fade out smoothly when Stage 2 completes */}
      <AnimatePresence>
        {!stage2Complete && (
          <motion.div
            className="absolute left-1/2 z-30 pointer-events-none"
            style={{
              x: '-50%',
              top: 'calc(28% + 160px)', // Below Leo
            }}
            animate={{ 
              opacity: isInhaling ? [0.3, 0.95, 0.95] : [0.95, 0.3, 0.3],
              scale: isInhaling ? [0.95, 1.08, 1.08] : [1.08, 0.92, 0.92],
            }}
            transition={{ 
              duration: activeCycle.in,
              ease: EASING,
              times: [0, 0.5, 1],
            }}
            exit={{ opacity: 0, transition: { duration: 1.5, ease: 'easeOut' } }}
          >
            <div
              className="text-4xl font-sans tracking-widest lowercase font-light"
              style={{
                color: 'rgba(255, 255, 255, 0.9)',
                textShadow: `
                  0 0 20px rgba(255, 255, 255, 0.8),
                  0 0 40px rgba(255, 255, 255, 0.6),
                  0 2px 8px rgba(0,0,0,0.4)
                `,
                letterSpacing: '0.35em',
              }}
            >
              {isInhaling ? 'inhale' : 'exhale'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2 Complete: No poem displayed - clean visual hold state */}
      {/* Sky, building, Leo, and ambient pulse continue */}
      {/* All text has faded out above */}

      {/* City skyline with towers - primary repositioned to center-left */}
      <motion.div
        ref={buildingContainerRef}
        className="absolute bottom-0 left-0 right-0 z-25"
        style={{ height: '50vh' }}
      >
        {TOWERS.map(tower => {
          const isPrimary = tower.id === primary;
          const towerOpacity = isPrimary ? 1 : 0;
          const displayX = isPrimary ? getPrimaryTowerX(tower.id) : tower.x;
          
          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${displayX}%`,
                width: '80px',
                height: `${tower.height * 1.8}px`,
              }}
              animate={{
                opacity: towerOpacity,
                scale: isPrimary ? (isInhaling ? 1.02 : 0.98) : 1,
              }}
              transition={{ 
                opacity: { 
                  duration: isPrimary ? 0.5 : 2.5, // Slower fade for non-primary to avoid flash
                  delay: isPrimary ? 2 : 1.5, // Delay both to avoid white flash gap
                },
                scale: { duration: activeCycle.in, ease: EASING }
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
                {/* Windows */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.floor((tower.height * 1.8) / 25) * 4 }).map((_, i) => (
                    <motion.div
                      key={`window-${tower.id}-${i}`}
                      className="rounded-[1px]"
                      animate={{
                        backgroundColor: [
                          `rgba(248, 216, 181, ${towerOpacity * 0.15})`,
                          `rgba(255, 230, 200, ${towerOpacity * 0.5})`,
                          `rgba(248, 216, 181, ${towerOpacity * 0.15})`,
                        ],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>

                {/* Building name - fade out when Stage 2 completes */}
                <AnimatePresence>
                  {isPrimary && !stage2Complete && (
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-5xl md:text-6xl font-bold z-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 2, ease: 'easeOut' } }}
                      transition={{ duration: 1, delay: 2.5 }}
                      style={{
                        top: '-10rem', // Moved up from -top-32 (-8rem) to avoid inhale/exhale overlap
                        color: tower.color,
                        textShadow: `
                          0 0 60px ${tower.color},
                          0 0 120px ${tower.color},
                          0 0 180px ${tower.color},
                          0 0 240px ${tower.color}80,
                          0 2px 12px rgba(0,0,0,0.4)
                        `,
                      }}
                    >
                      {zoneName}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Breathing halo */}
                {isPrimary && isReady && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
                    style={{
                      top: '-10rem', // Match building name position
                      background: `radial-gradient(circle, ${tower.color}66 0%, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                    animate={{ scale: isInhaling ? 1.4 : 0.8 }}
                    transition={{ duration: activeCycle.in, ease: EASING }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Floating poem - shows complete line, floats upward like smoke */}
      <AnimatePresence>
        {floatingPoem && (
          <motion.div
            key={floatingPoem.id}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
            initial={{ opacity: 0, y: 0, scale: 0.9 }}
            animate={{ 
              opacity: [0, 1, 1, 0.7, 0],
              y: [0, -50, -120, -200, -300],
              scale: [0.9, 1, 1.02, 1.05, 1.1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 6,
              times: [0, 0.2, 0.5, 0.8, 1],
              ease: [0.4, 0, 0.2, 1], // easeInOutCirc
            }}
          >
            <div
              className="text-3xl md:text-4xl font-serif italic font-medium text-center leading-relaxed px-8 max-w-2xl"
              style={{
                color: '#FFD700',
                textShadow: `
                  0 0 25px #FFD700,
                  0 0 50px #FFD700,
                  0 0 75px #FFD70080,
                  0 4px 12px rgba(0,0,0,0.4)
                `,
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              {floatingPoem.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leo speech bubbles (tips only, no window bubble) */}
      {stage2Complete && stage2Payload && (() => {
        // Get container and element rects for absolute positioning
        const containerRect = breathingContainerRef.current?.getBoundingClientRect();
        const leoRect = leoContainerRef.current?.getBoundingClientRect();
        
        if (!containerRect) return null;
        
        // Leo bubble: Anchored above Leo's head
        const leoAnchor = {
          x: containerRect.width / 2, // Match left: 50%
          y: containerRect.height * 0.28 - 120, // Above Leo
        };
        
        return (
          <>
            {/* Leo Bubble (Tips only - poems float independently) */}
            {leoAnchor && (
              <ComicBubble
                content={
                  bubbleStep === 'tip1' ? (stage2Payload.tips[0] || '')
                  : bubbleStep === 'tip2' ? (stage2Payload.tips[1] || '')
                  : bubbleStep === 'tip3' ? (stage2Payload.tips[2] || '')
                  : ''
                }
                state={leoBubbleState}
                type="tip"
                anchorPosition={leoAnchor}
                tailDirection="down-left"
                maxWidth={Math.min(480, containerRect.width * 0.85)}
                breathProgress={breathProgress}
              />
            )}
          </>
        );
      })()}
      
      {/* Ghibli-inspired Mark Done button - sage green, soft shadows, handwritten feel */}
      <AnimatePresence>
        {showMarkDoneButton && (
          <motion.div
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-60"
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.button
              onClick={() => handleMarkDone(currentTipIndex)}
              className="relative px-10 py-4 rounded-full bg-gradient-to-br from-[#8BA888] via-[#9BB89A] to-[#A8C5A6] text-white shadow-[0_8px_30px_rgba(139,168,136,0.35)] border border-white/20 backdrop-blur-sm overflow-hidden"
              whileHover={{ 
                scale: 1.03,
                boxShadow: '0 12px 40px rgba(139,168,136,0.45)',
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Ghibli-style soft glow overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/10 to-white/20 rounded-full"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Button content */}
              <div className="relative flex items-center gap-3">
                <motion.span 
                  className="text-2xl"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  ✓
                </motion.span>
                <span 
                  className="text-lg font-light tracking-wide"
                  style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.05em' }}
                >
                  Mark Done
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}
        
        {/* Completion feedback - gentle Ghibli-style confirmation */}
        {markedTips.includes(currentTipIndex + 1) && showMarkDoneButton === false && (
          <motion.div
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-60 bg-white/95 backdrop-blur-md px-8 py-4 rounded-full shadow-[0_8px_30px_rgba(139,168,136,0.25)] border border-[#8BA888]/20"
            initial={{ opacity: 0, scale: 0.75, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[#6B8E6A] font-light flex items-center gap-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              <motion.span 
                className="text-2xl"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              >
                ✓
              </motion.span>
              <span className="text-lg tracking-wide">Ritual complete</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}



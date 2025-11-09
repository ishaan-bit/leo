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
  const [words, setWords] = useState<Array<{ id: string; text: string; angle: number; index: number }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [stage2Complete, setStage2Complete] = useState(false);
  
  // Bubble sequence state (post-Stage 2)
  // NEW: 3-poem flow with simplified steps
  type BubbleSequenceStep = 
    | 'idle' 
    | 'leo_poem1' | 'tip1' | 'mark_done_1'
    | 'leo_poem2' | 'tip2' | 'mark_done_2'
    | 'leo_poem3' | 'tip3' | 'mark_done_3'
    | 'sky' | 'gradientReturn';
  
  const [bubbleStep, setBubbleStep] = useState<BubbleSequenceStep>('idle');
  const [leoBubbleState, setLeoBubbleState] = useState<'hidden' | 'text' | 'ellipsis'>('hidden');
  const [windowBubbleState, setWindowBubbleState] = useState<'hidden' | 'text' | 'ellipsis'>('hidden');
  const [skyLightnessLevel, setSkyLightnessLevel] = useState(0); // 0-3
  const [leoReacting, setLeoReacting] = useState(false); // For poem line reactions
  const [windowGlowing, setWindowGlowing] = useState(false); // For tip window glow
  
  // "Mark Done" state - tracks which tips have been marked
  const [markedTips, setMarkedTips] = useState<number[]>([]); // [1, 2, 3] as they're marked
  const [currentTipIndex, setCurrentTipIndex] = useState(0); // 0 = tip1, 1 = tip2, 2 = tip3
  const [showMarkDoneButton, setShowMarkDoneButton] = useState(false);
  
  // DEBUG mode for bubble positioning overlays
  const DEBUG_BUBBLES = typeof window !== 'undefined' && window.location.search.includes('debug=bubbles');
  
  // Stage 2 state
  const [stage2, setStage2] = useState<Stage2State>({
    phase: 'idle',
    payload: null,
    window: null,
    currentTipIndex: 0,
    stage2CycleCount: 0,
    started: false,
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordPool = useRef<string[]>([]);
  const wordIndexCounter = useRef<number>(0); // Track word index for EN/HI alternation
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const leoContainerRef = useRef<HTMLDivElement>(null);
  const buildingContainerRef = useRef<HTMLDivElement>(null);
  const orchestrationStartedRef = useRef(false); // Prevent duplicate orchestration runs
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

  // Initialize word pool - ONLY invoked, expressed, primary, secondary, tertiary
  useEffect(() => {
    const initWords = async () => {
      try {
        console.log('[Breathing] 🔍 DEBUG initWords:', {
          'invokedWords prop': invokedWords,
          'invokedWords.length': invokedWords.length,
        });
        
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) throw new Error('Failed to fetch reflection');
        
        const reflection = await response.json();
        const pool: string[] = [];
        
        // 1. Invoked words (primary source)
        if (invokedWords.length > 0) pool.push(...invokedWords);
        
        console.log('[Breathing] 🔍 After invokedWords, pool:', pool);
        
        // 2. Expressed emotion
        if (reflection.final?.expressed && reflection.final.expressed !== 'null') {
          const expressed = reflection.final.expressed.split(/[+\s]+/).map((w: string) => w.trim()).filter(Boolean);
          pool.push(...expressed);
        }
        
        console.log('[Breathing] 🔍 After expressed, pool:', pool);
        
        // 3. Context headline (if available) - add as complete phrase
        if (reflection.final?.context?.event_headline) {
          const headline = reflection.final.context.event_headline;
          if (headline && headline.length > 2) {
            pool.push(headline); // Add the full headline as a phrase
            console.log('[Breathing] 🔍 Added context headline phrase:', headline);
          }
        }
        
        console.log('[Breathing] 🔍 After context headline, pool:', pool);
        
        // 4. Wheel emotions ONLY (no random text words)
        if (reflection.final?.wheel?.primary) pool.push(reflection.final.wheel.primary);
        if (reflection.final?.wheel?.secondary) pool.push(reflection.final.wheel.secondary);
        if (reflection.final?.wheel?.tertiary) pool.push(reflection.final.wheel.tertiary);
        
        console.log('[Breathing] 🔍 After wheel, pool:', pool);
        
        // Filter out short/meaningless words
        const filteredPool = pool.filter(w => w && w.length > 2);
        
        wordPool.current = filteredPool.length > 0 ? filteredPool : [...FALLBACK_WORDS];
        console.log('[Breathing] ✅ Final word pool:', wordPool.current.length, 'words', wordPool.current);
      } catch (error) {
        console.error('[Breathing] Failed to load words:', error);
        wordPool.current = [...FALLBACK_WORDS];
      }
    };
    
    initWords();
  }, [reflectionId, invokedWords]);

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
        
        // Check for post_enrichment payload (at top level or under final for backwards compat)
        const postEnrichment = reflection.post_enrichment || reflection.final?.post_enrichment;
        if (postEnrichment && !stage2.started) {
          
          console.log('[Stage2] Post-enrichment received:', postEnrichment);
          
          // Initialize Stage 2 with payload
          setStage2(prev => ({
            ...prev,
            payload: {
              poems: postEnrichment.poems || ['...', '...', '...'],
              tips: postEnrichment.tips || [],
              closing_line: postEnrichment.closing_line || '',
              tip_moods: postEnrichment.tip_moods || [],
            },
            window: {
              lit: false,
              window_id: reflectionId,
              x: 35, // Primary tower X position
              y: 35 + Math.random() * 20, // Mid-height on tower
              opacity: 0,
              glow: 0,
            },
            phase: 'idle', // Stage 2 orchestrator handles bubble sequence
            started: true,
          }));
          
          // IMMEDIATELY trigger bubble sequence - no waiting for breath cycles
          console.log('[Breathing] ? Triggering bubble sequence immediately');
          setStage2Complete(true);
        }
        
        // Check for overall completion status (backup trigger only if stage2 not started yet)
        const status = reflection.status || reflection.final?.status;
        if (status === 'complete' && !stage2Complete && !stage2.started) {
          console.log('[Breathing] Stage-2 complete (backup trigger), cycle:', cycleCount);
          setStage2Complete(true);
        }
      } catch (error) {
        console.error('[Breathing] Poll error:', error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [reflectionId, cycleCount, stage2.started]);

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
  }, [isReady, cycleDuration, cycleCount, stage2Complete, stage2, onComplete]);

  // Add floating words periodically - fade out when Stage 2 completes
  useEffect(() => {
    console.log('[Breathing] 🔍 Floating words effect check:', {
      isReady,
      'wordPool.length': wordPool.current.length,
      stage2Complete,
    });
    
    if (!isReady || wordPool.current.length === 0) {
      console.log('[Breathing] ⏸️ Floating words paused - isReady:', isReady, 'wordPool:', wordPool.current.length);
      return;
    }
    
    console.log('[Breathing] ▶️ Starting floating words with pool:', wordPool.current);
    
    // Stop and clear all words when Stage 2 completes
    if (stage2Complete) {
      console.log('[Breathing] 🧹 Stage 2 complete, clearing all floating words');
      setWords([]); // Clear all existing words
      return;
    }
    
    const addWord = async () => {
      const word = wordPool.current[Math.floor(Math.random() * wordPool.current.length)];
      const wordId = `word-${Date.now()}-${Math.random()}`;
      const angle = Math.random() * Math.PI * 2;
      const index = wordIndexCounter.current++;
      
      // Alternate: even index = English, odd index = Hindi
      const shouldTranslate = index % 2 === 1;
      let displayText = word;
      
      if (shouldTranslate) {
        try {
          const translated = await translateToHindi(word);
          displayText = translated.translatedText || word; // Fallback to English if translation fails
        } catch (error) {
          console.warn('[Breathing] Translation failed for word:', word, error);
          // Keep original English word
        }
      }
      
      setWords(prev => [...prev, { id: wordId, text: displayText, angle, index }]);
      
      setTimeout(() => {
        setWords(prev => prev.filter(w => w.id !== wordId));
      }, 5000);
    };
    
    // Add first word immediately
    addWord();
    
    const interval = setInterval(addWord, 5000);
    return () => clearInterval(interval);
  }, [isReady, stage2Complete]);

  // Bubble sequence orchestration (post-Stage 2 completion)
  // EVENT-DRIVEN STATE MACHINE: Each step advances based on user interaction (Mark Done clicks)
  useEffect(() => {
    if (!stage2Complete || !stage2.payload) {
      return;
    }
    
    // Guard: Prevent duplicate orchestration runs
    if (orchestrationStartedRef.current) {
      return;
    }
    
    orchestrationStartedRef.current = true;
    console.log('[Bubble Sequence] 🎬 Starting event-driven orchestration');
    
    const poems = stage2.payload.poems || [];
    const tips = stage2.payload.tips || [];
    
    // Initial transition: Start with poem 1 after brief delay
    setTimeout(() => {
      if (poems[0]) {
        console.log('[Bubble Sequence] 📖 Showing poem 1');
        setBubbleStep('leo_poem1');
        setLeoBubbleState('text');
        
        // Leo reaction
        setTimeout(() => {
          setLeoReacting(true);
          setTimeout(() => setLeoReacting(false), 700);
        }, 800);
        
        // Hold poem, then transition to tip 1
        setTimeout(() => {
          setLeoBubbleState('ellipsis');
          setTimeout(() => {
            setLeoBubbleState('hidden');
            
            // Show tip 1 after gap
            setTimeout(() => {
              if (tips[0]) {
                console.log('[Bubble Sequence] 💡 Showing tip 1');
                setBubbleStep('tip1');
                setWindowBubbleState('text');
                setWindowGlowing(true);
                
                // Hold tip, then show Mark Done button
                setTimeout(() => {
                  setWindowBubbleState('ellipsis');
                  setWindowGlowing(false);
                  setTimeout(() => {
                    setWindowBubbleState('hidden');
                    
                    // Show Mark Done for tip 1
                    setTimeout(() => {
                      console.log('[Bubble Sequence] ✅ Showing Mark Done for tip 1');
                      setBubbleStep('mark_done_1');
                      setCurrentTipIndex(0);
                      setShowMarkDoneButton(true);
                    }, 400);
                  }, 600);
                }, 2200);
              }
            }, 400);
          }, 600);
        }, 2200);
      }
    }, 500);
  }, [stage2Complete, stage2.payload]);
  
  // Watch for Mark Done clicks and advance to next poem/tip cycle
  useEffect(() => {
    if (markedTips.length === 0 || !stage2.payload) return;
    
    const lastMarked = Math.max(...markedTips);
    const poems = stage2.payload.poems || [];
    const tips = stage2.payload.tips || [];
    
    // Tip 1 marked → Show poem 2
    if (lastMarked === 1 && markedTips.length === 1) {
      setTimeout(() => {
        if (poems[1]) {
          console.log('[Bubble Sequence] 📖 Showing poem 2 after tip 1 marked');
          setBubbleStep('leo_poem2');
          setLeoBubbleState('text');
          
          setTimeout(() => {
            setLeoReacting(true);
            setTimeout(() => setLeoReacting(false), 700);
          }, 800);
          
          setTimeout(() => {
            setLeoBubbleState('ellipsis');
            setTimeout(() => {
              setLeoBubbleState('hidden');
              
              setTimeout(() => {
                if (tips[1]) {
                  console.log('[Bubble Sequence] 💡 Showing tip 2');
                  setBubbleStep('tip2');
                  setWindowBubbleState('text');
                  setWindowGlowing(true);
                  
                  setTimeout(() => {
                    setWindowBubbleState('ellipsis');
                    setWindowGlowing(false);
                    setTimeout(() => {
                      setWindowBubbleState('hidden');
                      
                      setTimeout(() => {
                        console.log('[Bubble Sequence] ✅ Showing Mark Done for tip 2');
                        setBubbleStep('mark_done_2');
                        setCurrentTipIndex(1);
                        setShowMarkDoneButton(true);
                      }, 400);
                    }, 600);
                  }, 2200);
                }
              }, 400);
            }, 600);
          }, 2200);
        }
      }, 800);
    }
    
    // Tip 2 marked → Show poem 3
    else if (lastMarked === 2 && markedTips.length === 2) {
      setTimeout(() => {
        if (poems[2]) {
          console.log('[Bubble Sequence] 📖 Showing poem 3 after tip 2 marked');
          setBubbleStep('leo_poem3');
          setLeoBubbleState('text');
          
          setTimeout(() => {
            setLeoReacting(true);
            setTimeout(() => setLeoReacting(false), 700);
          }, 800);
          
          setTimeout(() => {
            setLeoBubbleState('ellipsis');
            setTimeout(() => {
              setLeoBubbleState('hidden');
              
              setTimeout(() => {
                if (tips[2]) {
                  console.log('[Bubble Sequence] 💡 Showing tip 3');
                  setBubbleStep('tip3');
                  setWindowBubbleState('text');
                  setWindowGlowing(true);
                  
                  setTimeout(() => {
                    setWindowBubbleState('ellipsis');
                    setWindowGlowing(false);
                    setTimeout(() => {
                      setWindowBubbleState('hidden');
                      
                      setTimeout(() => {
                        console.log('[Bubble Sequence] ✅ Showing Mark Done for tip 3');
                        setBubbleStep('mark_done_3');
                        setCurrentTipIndex(2);
                        setShowMarkDoneButton(true);
                      }, 400);
                    }, 600);
                  }, 2200);
                }
              }, 400);
            }, 600);
          }, 2200);
        }
      }, 800);
    }
    
    // Tip 3 marked → Sky brightening → Transition to Living City
    else if (lastMarked === 3 && markedTips.length === 3) {
      console.log('[Bubble Sequence] 🌅 All tips marked, transitioning to Living City');
      
      setTimeout(() => {
        console.log('[Bubble Sequence] ☀️ Sky brightening');
        setBubbleStep('sky');
        setSkyLightnessLevel(3);
        
        setTimeout(() => {
          console.log('[Bubble Sequence] 🎨 Gradient return');
          setBubbleStep('gradientReturn');
          setSkyLightnessLevel(4);
          
          setTimeout(() => {
            console.log('[Bubble Sequence] ✅ Transition to Living City');
            onComplete();
          }, 2500);
        }, 2000);
      }, 1000);
    }
  }, [markedTips, stage2.payload, onComplete]);

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

      {/* Floating words - fade out when Stage 2 completes */}
      <AnimatePresence>
        {words.map(word => {
          // Safe zones: avoid top 15% (auth bar), center 30-45% vertical (Leo + prompts)
          // Place words with more padding from edges to prevent cutoff
          const angle = word.angle;
          const normalizedAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          
          // Determine safe vertical zone based on angle quadrant
          let x, y;
          
          if (normalizedAngle < Math.PI / 2) {
            // Top-right quadrant → place in upper-right safe zone
            x = 60 + Math.random() * 20; // 60-80% (more centered)
            y = 18 + Math.random() * 10; // 18-28% (below auth bar, above Leo)
          } else if (normalizedAngle < Math.PI) {
            // Bottom-right quadrant → place in lower-right safe zone
            x = 60 + Math.random() * 20; // 60-80% (more centered)
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else if (normalizedAngle < Math.PI * 1.5) {
            // Bottom-left quadrant → place in lower-left safe zone
            x = 15 + Math.random() * 20; // 15-35% (more centered)
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else {
            // Top-left quadrant → place in upper-left safe zone
            x = 15 + Math.random() * 20; // 15-35% (more centered)
            y = 18 + Math.random() * 10; // 18-28% (below auth bar, above Leo)
          }
          
          return (
            <motion.div
              key={word.id}
              className="absolute pointer-events-none will-change-transform z-40"
              style={{ 
                left: `${x}%`, 
                top: `${y}%`,
                transform: 'translateZ(0)', // Force GPU acceleration on mobile
                backfaceVisibility: 'hidden', // Improve mobile rendering
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.05, y: -20 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 1.5, ease: 'easeOut' } }}
              transition={{ duration: 6, ease: EASING }}
            >
              {/* Split text into max 2 words per line for multi-word phrases */}
              {(() => {
                const words = word.text.split(/\s+/);
                if (words.length <= 2) {
                  // Single line if 1-2 words
                  return (
                    <span
                      className="text-2xl md:text-3xl font-serif italic font-bold"
                      style={{
                        color: '#FFD700',
                        textShadow: `
                          0 0 20px #FFD700,
                          0 0 40px #FFD700,
                          0 0 60px #FFD70080,
                          0 4px 8px rgba(0,0,0,0.6)
                        `,
                        WebkitFontSmoothing: 'antialiased',
                      }}
                    >
                      {word.text}
                    </span>
                  );
                } else {
                  // Multi-line: 2 words per line
                  const line1 = words.slice(0, 2).join(' ');
                  const line2 = words.slice(2, 4).join(' ');
                  return (
                    <div className="text-center leading-tight">
                      <div
                        className="text-2xl md:text-3xl font-serif italic font-bold"
                        style={{
                          color: '#FFD700',
                          textShadow: `
                            0 0 20px #FFD700,
                            0 0 40px #FFD700,
                            0 0 60px #FFD70080,
                            0 4px 8px rgba(0,0,0,0.6)
                          `,
                          WebkitFontSmoothing: 'antialiased',
                        }}
                      >
                        {line1}
                      </div>
                      {line2 && (
                        <div
                          className="text-2xl md:text-3xl font-serif italic font-bold"
                          style={{
                            color: '#FFD700',
                            textShadow: `
                              0 0 20px #FFD700,
                              0 0 40px #FFD700,
                              0 0 60px #FFD70080,
                              0 4px 8px rgba(0,0,0,0.6)
                            `,
                            WebkitFontSmoothing: 'antialiased',
                          }}
                        >
                          {line2}
                        </div>
                      )}
                    </div>
                  );
                }
              })()}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Comic Bubbles - Post-Stage 2 Sequence */}
      {stage2Complete && stage2.payload && (() => {
        // Get container and element rects for absolute positioning
        const containerRect = breathingContainerRef.current?.getBoundingClientRect();
        const leoRect = leoContainerRef.current?.getBoundingClientRect();
        const buildingRect = buildingContainerRef.current?.getBoundingClientRect();
        
        if (!containerRect) return null;
        
        // Leo bubble: Use center-based positioning since Leo is at left: 50%, top: 28%
        // This matches Leo's actual CSS positioning rather than relying on getBoundingClientRect
        // which can be affected by transforms
        const leoAnchor = {
          x: containerRect.width / 2, // Match left: 50%
          y: containerRect.height * 0.28 - 120, // Match top: 28% (Leo's actual position), offset up by ~120px to clear Leo
        };
        
        // Building/Tips bubble: Anchored to the PRIMARY tower (always at 35% from left, bottom of screen)
        // Calculate position based on primary tower's actual location
        const buildingAnchor = buildingRect ? {
          x: (containerRect.width * 0.35) + 40, // 35% from left (primary tower position) + 40px offset into building
          y: buildingRect.top - containerRect.top + 40, // 40px from top of building container
        } : null;
        
        if (DEBUG_BUBBLES) {
          console.log('[Bubble Positions - Absolute]', {
            bubbleStep,
            containerRect: { x: containerRect.left, y: containerRect.top, width: containerRect.width, height: containerRect.height },
            leoRect: leoRect ? { x: leoRect.left, y: leoRect.top, width: leoRect.width, height: leoRect.height } : null,
            buildingRect: buildingRect ? { x: buildingRect.left, y: buildingRect.top, width: buildingRect.width, height: buildingRect.height } : null,
            leoAnchor,
            buildingAnchor,
            leoBubbleState,
            windowBubbleState,
            calculation: {
              leoX: `${containerRect.width} / 2 = ${containerRect.width / 2}`,
              leoY: `${containerRect.height} * 0.35 - 120 = ${containerRect.height * 0.35 - 120}`,
            },
          });
        }
        
        return (
          <>
            {/* DEBUG: Visual anchor overlays */}
            {DEBUG_BUBBLES && (
              <>
                {/* Leo anchor point - RED DOT */}
                {leoAnchor && (
                  <div
                    className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white pointer-events-none shadow-lg"
                    style={{
                      left: leoAnchor.x - 8,
                      top: leoAnchor.y - 8,
                      zIndex: 100,
                    }}
                    title="Leo Anchor"
                  />
                )}
                
                {/* Building anchor point - BLUE DOT */}
                {buildingAnchor && (
                  <div
                    className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white pointer-events-none shadow-lg"
                    style={{
                      left: buildingAnchor.x - 8,
                      top: buildingAnchor.y - 8,
                      zIndex: 100,
                    }}
                    title="Building Anchor"
                  />
                )}
                
                {/* Leo container outline - RED */}
                {leoRect && (
                  <div
                    className="absolute border-2 border-red-500 pointer-events-none bg-red-500/10"
                    style={{
                      left: leoRect.left - containerRect.left,
                      top: leoRect.top - containerRect.top,
                      width: leoRect.width,
                      height: leoRect.height,
                      zIndex: 99,
                    }}
                    title="Leo Container"
                  />
                )}
                
                {/* Building container outline - BLUE */}
                {buildingRect && (
                  <div
                    className="absolute border-2 border-blue-500 pointer-events-none bg-blue-500/10"
                    style={{
                      left: buildingRect.left - containerRect.left,
                      top: buildingRect.top - containerRect.top,
                      width: buildingRect.width,
                      height: buildingRect.height,
                      zIndex: 99,
                    }}
                    title="Building Container"
                  />
                )}
              </>
            )}

            {/* Leo Bubble (Poems) - Anchored to Leo's head */}
            {leoAnchor && (
              <ComicBubble
                content={
                  bubbleStep === 'leo_poem1' ? (stage2.payload.poems[0] || 'Breathing...')
                  : bubbleStep === 'leo_poem2' ? (stage2.payload.poems[1] || 'Just breathe...')
                  : bubbleStep === 'leo_poem3' ? (stage2.payload.poems[2] || '')
                  : ''
                }
                state={leoBubbleState}
                type="poem"
                anchorPosition={leoAnchor}
                tailDirection="down-left" // Diagonal southwest tail
                maxWidth={Math.min(480, containerRect.width * 0.85)} // Responsive width
                breathProgress={breathProgress}
              />
            )}

            {/* Building/Tips Bubble - Anchored to top-left of building */}
            {buildingAnchor && (
              <ComicBubble
                content={
                  bubbleStep === 'tip1' ? (stage2.payload.tips[0] || '')
                  : bubbleStep === 'tip2' ? (stage2.payload.tips[1] || '')
                  : bubbleStep === 'tip3' ? (stage2.payload.tips[2] || '')
                  : ''
                }
                state={windowBubbleState}
                type="tip"
                anchorPosition={buildingAnchor}
                tailDirection="down" // Point down to building
                maxWidth={Math.min(340, containerRect.width * 0.75)} // Responsive width
                breathProgress={breathProgress}
              />
            )}
          </>
        );
      })()}
      
      {/* "Mark Done" button - appears after each tip */}
      <AnimatePresence>
        {showMarkDoneButton && (
          <motion.div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-60"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.button
              onClick={() => handleMarkDone(currentTipIndex)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 rounded-full font-medium shadow-2xl hover:shadow-green-500/50 transition-all duration-300 flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-2xl">✓</span>
              <span className="text-lg">Mark Done</span>
            </motion.button>
          </motion.div>
        )}
        
        {/* Completion feedback - shown briefly after each tip marked */}
        {markedTips.includes(currentTipIndex + 1) && showMarkDoneButton === false && (
          <motion.div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-60 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-xl border border-green-200"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-green-700 font-medium flex items-center gap-2">
              <span className="text-xl">✓</span>
              <span>Ritual complete</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}



'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { type PrimaryEmotion, computeBreatheParams, FALLBACK_WORDS } from '@/lib/breathe-config';
import type { Stage2State, PostEnrichmentPayload, Stage2Phase, WindowState } from '@/lib/stage2-types';
import ComicBubble from '../atoms/ComicBubble';

interface BreathingSequenceProps {
  reflectionId: string;
  primary: PrimaryEmotion;
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
  const [words, setWords] = useState<Array<{ id: string; text: string; angle: number }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [stage2Complete, setStage2Complete] = useState(false);
  
  // Bubble sequence state (post-Stage 2)
  // NEW: 3-poem flow with simplified steps
  type BubbleSequenceStep = 
    | 'idle' 
    | 'leo_poem1' | 'tip1' 
    | 'leo_poem2' | 'tip2'
    | 'leo_poem3' | 'tip3'
    | 'sky' | 'gradientReturn' 
    | 'cta';
  
  const [bubbleStep, setBubbleStep] = useState<BubbleSequenceStep>('idle');
  const [leoBubbleState, setLeoBubbleState] = useState<'hidden' | 'text' | 'ellipsis'>('hidden');
  const [windowBubbleState, setWindowBubbleState] = useState<'hidden' | 'text' | 'ellipsis'>('hidden');
  const [skyLightnessLevel, setSkyLightnessLevel] = useState(0); // 0-3
  const [leoReacting, setLeoReacting] = useState(false); // For poem line reactions
  const [windowGlowing, setWindowGlowing] = useState(false); // For tip window glow
  
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
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const leoContainerRef = useRef<HTMLDivElement>(null);
  const buildingContainerRef = useRef<HTMLDivElement>(null);
  const orchestrationStartedRef = useRef(false); // Prevent duplicate orchestration runs
  const breathingContainerRef = useRef<HTMLDivElement>(null);
  
  const breatheParams = computeBreatheParams(primary, secondary);
  const { cycle, color, audio } = breatheParams;
  
  // Use normal breathing cycle (orchestrator handles its own timing)
  const activeCycle = cycle;
  const cycleDuration = (activeCycle.in + activeCycle.out) * 1000; // ms
  const primaryTower = TOWERS.find(t => t.id === primary) || TOWERS[0];

  // Initialize word pool - ONLY invoked, expressed, primary, secondary, tertiary
  useEffect(() => {
    const initWords = async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) throw new Error('Failed to fetch reflection');
        
        const reflection = await response.json();
        const pool: string[] = [];
        
        // 1. Invoked words (primary source)
        if (invokedWords.length > 0) pool.push(...invokedWords);
        
        // 2. Expressed emotion
        if (reflection.final?.expressed && reflection.final.expressed !== 'null') {
          const expressed = reflection.final.expressed.split(/[+\s]+/).map((w: string) => w.trim()).filter(Boolean);
          pool.push(...expressed);
        }
        
        // 3. Wheel emotions ONLY (no random text words)
        if (reflection.final?.wheel?.primary) pool.push(reflection.final.wheel.primary);
        if (reflection.final?.wheel?.secondary) pool.push(reflection.final.wheel.secondary);
        if (reflection.final?.wheel?.tertiary) pool.push(reflection.final.wheel.tertiary);
        
        // Filter out short/meaningless words
        const filteredPool = pool.filter(w => w && w.length > 2);
        
        wordPool.current = filteredPool.length > 0 ? filteredPool : [...FALLBACK_WORDS];
        console.log('[Breathing] Word pool:', wordPool.current.length, 'words', wordPool.current);
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
    if (!isReady || wordPool.current.length === 0) return;
    
    // Stop and clear all words when Stage 2 completes
    if (stage2Complete) {
      setWords([]); // Clear all existing words
      return;
    }
    
    const addWord = () => {
      const word = wordPool.current[Math.floor(Math.random() * wordPool.current.length)];
      const wordId = `word-${Date.now()}-${Math.random()}`;
      const angle = Math.random() * Math.PI * 2;
      
      setWords(prev => [...prev, { id: wordId, text: word, angle }]);
      
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
  useEffect(() => {
    console.log('[Bubble Sequence] Effect triggered:', { 
      stage2Complete, 
      hasPayload: !!stage2.payload,
      orchestrationStarted: orchestrationStartedRef.current,
      payload: stage2.payload,
      poems: stage2.payload?.poems,
      tips: stage2.payload?.tips
    });
    
    if (!stage2Complete) {
      console.log('[Bubble Sequence] Not starting - stage2 not complete');
      return;
    }
    
    // Guard: Prevent duplicate orchestration runs
    if (orchestrationStartedRef.current) {
      console.log('[Bubble Sequence] ? Orchestration already running, skipping duplicate effect');
      return;
    }
    
    // If no payload yet, try to fetch the reflection to get post_enrichment
    if (!stage2.payload) {
      console.log('[Bubble Sequence] No payload yet, fetching reflection data...');
      
      const fetchReflectionData = async () => {
        try {
          const response = await fetch(`/api/reflect/${reflectionId}`);
          if (!response.ok) throw new Error('Failed to fetch reflection');
          
          const reflection = await response.json();
          console.log('[Bubble Sequence] Full reflection response:', reflection);
          console.log('[Bubble Sequence] reflection.final:', reflection.final);
          console.log('[Bubble Sequence] reflection.post_enrichment:', reflection.post_enrichment);
          console.log('[Bubble Sequence] reflection.final?.post_enrichment:', reflection.final?.post_enrichment);
          
          // Check if post_enrichment is at root level or in final
          const postEnrichment = reflection.post_enrichment || reflection.final?.post_enrichment;
          
          if (postEnrichment) {
            console.log('[Bubble Sequence] Found post_enrichment:', postEnrichment);
            
            // Update stage2 with the payload we just got
            setStage2(prev => ({
              ...prev,
              payload: {
                poems: postEnrichment.poems || ['...', '...'],
                tips: postEnrichment.tips || [],
                closing_line: postEnrichment.closing_line || '',
                tip_moods: postEnrichment.tip_moods || [],
              },
            }));
            
            console.log('[Bubble Sequence] Payload set from fresh fetch!');
          } else {
            console.log('[Bubble Sequence] No post_enrichment in reflection yet - waiting...');
          }
        } catch (error) {
          console.error('[Bubble Sequence] Error fetching reflection:', error);
        }
      };
      
      fetchReflectionData();
      return; // Exit this effect run, will re-run when stage2.payload updates
    }
    
    // Mark orchestration as started to prevent duplicate runs
    orchestrationStartedRef.current = true;
    console.log('[Bubble Sequence] ?? Starting orchestration!');
    
    const FADE_IN = 800;
    const HOLD_TEXT = 2200;
    const FADE_TO_ELLIPSIS = 600;
    const GAP_BETWEEN_BUBBLES = 400;
    const SKY_STEP = 2000;
    const GRADIENT_RETURN = 2500;
    
    const poems = stage2.payload.poems || ['', ''];
    const tips = stage2.payload.tips || [];
    
    console.log('[Bubble Sequence] Poems:', poems);
    console.log('[Bubble Sequence] Tips:', tips);
    
    // NEW: Handle 3 standalone poems (no comma splitting needed)
    const poem1 = poems[0] || '';
    const poem2 = poems[1] || '';
    const poem3 = poems[2] || '';
    
    console.log('[Bubble Sequence] Poem1:', poem1);
    console.log('[Bubble Sequence] Poem2:', poem2);
    console.log('[Bubble Sequence] Poem3:', poem3);
    
    // Validate we have at least some content to show
    const hasContent = poem1 || poem2 || poem3 || tips.length > 0;
    if (!hasContent) {
      console.warn('[Bubble Sequence] ?? No poems or tips available, fast-forwarding to CTA');
    }
    
    // Debug: Calculate expected steps and timing
    // NEW FLOW: poem1 ? tip1 ? poem2 ? tip2 ? poem3 ? tip3 ? sky ? gradient ? CTA
    const activeSteps = [
      poem1 && 'poem1',
      tips[0] && 'tip1',
      poem2 && 'poem2',
      tips[1] && 'tip2',
      poem3 && 'poem3',
      tips[2] && 'tip3',
      'sky',
      'gradient',
      'cta',
      'transition'
    ].filter(Boolean);
    
    console.log('[Bubble Sequence] ?? Active steps:', activeSteps.join(' ? '));
    console.log('[Bubble Sequence] ??  Total steps:', activeSteps.length);
    
    const timeouts: NodeJS.Timeout[] = [];
    let currentTime = 0;
    
    const schedule = (callback: () => void, delay: number, stepName: string) => {
      currentTime += delay;
      console.log(`[Bubble Sequence] ??  Scheduling ${stepName} at ${(currentTime / 1000).toFixed(1)}s (+${delay}ms)`);
      const timeout = setTimeout(callback, currentTime);
      timeouts.push(timeout);
      return timeout;
    };
    
    // S1: Leo p1.l1 - First poem line appears
    // NEW FLOW: poem1 ? tip1 ? poem2 ? tip2 ? poem3 ? tip3 ? sky ? gradient ? CTA
    
    // S1: Poem 1 - First poem from Leo
    if (poem1) {
      console.log('[Bubble Sequence] ?? Poem 1:', poem1);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 1: Poem1 - Fade in');
        setBubbleStep('leo_poem1');
        setLeoBubbleState('text');
      }, 0, 'poem1-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Leo reacting to poem 1');
        setLeoReacting(true);
        setTimeout(() => setLeoReacting(false), 700);
      }, FADE_IN + 100, 'poem1-reaction');
      
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 1: Poem1 ? ellipsis');
        setLeoBubbleState('ellipsis');
      }, HOLD_TEXT, 'poem1-ellipsis');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 1: Poem1 ? hidden');
        setLeoBubbleState('hidden');
      }, FADE_TO_ELLIPSIS, 'poem1-hide');
    }
    
    // S2: Tip1 - First tip from window
    if (tips[0]) {
      console.log('[Bubble Sequence] ?? Tip 1:', tips[0]);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 2: Tip1 - Fade in');
        setBubbleStep('tip1');
        setWindowBubbleState('text');
        setWindowGlowing(true);
      }, GAP_BETWEEN_BUBBLES, 'tip1-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 2: Tip1 ? ellipsis');
        setWindowBubbleState('ellipsis');
        setWindowGlowing(false);
      }, FADE_IN + HOLD_TEXT, 'tip1-ellipsis');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 2: Tip1 ? hidden');
        setWindowBubbleState('hidden');
      }, FADE_TO_ELLIPSIS, 'tip1-hide');
    }
    
    // S3: Poem 2 - Second poem from Leo
    if (poem2) {
      console.log('[Bubble Sequence] ?? Poem 2:', poem2);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 3: Poem2 - Fade in');
        setBubbleStep('leo_poem2');
        setLeoBubbleState('text');
      }, GAP_BETWEEN_BUBBLES, 'poem2-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Leo reacting to poem 2');
        setLeoReacting(true);
        setTimeout(() => setLeoReacting(false), 700);
      }, FADE_IN + 100, 'poem2-reaction');
      
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 3: Poem2 ? ellipsis');
        setLeoBubbleState('ellipsis');
      }, HOLD_TEXT, 'poem2-ellipsis');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 3: Poem2 ? hidden');
        setLeoBubbleState('hidden');
      }, FADE_TO_ELLIPSIS, 'poem2-hide');
    }
    
    // S4: Tip2 - Second tip from window
    if (tips[1]) {
      console.log('[Bubble Sequence] ?? Tip 2:', tips[1]);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 4: Tip2 - Fade in');
        setBubbleStep('tip2');
        setWindowBubbleState('text');
        setWindowGlowing(true);
      }, GAP_BETWEEN_BUBBLES, 'tip2-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 4: Tip2 ? ellipsis');
        setWindowBubbleState('ellipsis');
        setWindowGlowing(false);
      }, FADE_IN + HOLD_TEXT, 'tip2-ellipsis');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 4: Tip2 ? hidden');
        setWindowBubbleState('hidden');
      }, FADE_TO_ELLIPSIS, 'tip2-hide');
    }
    
    // S5: Poem 3 - Third poem from Leo
    if (poem3) {
      console.log('[Bubble Sequence] ?? Poem 3:', poem3);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 5: Poem3 - Fade in');
        setBubbleStep('leo_poem3');
        setLeoBubbleState('text');
      }, GAP_BETWEEN_BUBBLES, 'poem3-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Leo reacting to poem 3');
        setLeoReacting(true);
        setTimeout(() => setLeoReacting(false), 700);
      }, FADE_IN + 100, 'poem3-reaction');
      
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 5: Poem3 ? ellipsis');
        setLeoBubbleState('ellipsis');
      }, HOLD_TEXT, 'poem3-ellipsis');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 5: Poem3 ? hidden');
        setLeoBubbleState('hidden');
      }, FADE_TO_ELLIPSIS, 'poem3-hide');
    }
    
    // S6: Tip3 - Third and final tip from window
    if (tips[2]) {
      console.log('[Bubble Sequence] ?? Tip 3:', tips[2]);
      schedule(() => {
        console.log('[Bubble Sequence] ??  Step 6: Tip3 - Fade in');
        setBubbleStep('tip3');
        setWindowBubbleState('text');
        setWindowGlowing(true);
      }, GAP_BETWEEN_BUBBLES, 'tip3-fadeIn');
      
      schedule(() => {
        console.log('[Bubble Sequence] ?? Step 6: Tip3 ? hidden (final tip fades completely)');
        setWindowBubbleState('hidden');
        setWindowGlowing(false);
      }, FADE_IN + HOLD_TEXT + FADE_TO_ELLIPSIS, 'tip3-hide');
    }
    
    // S7: Sky brightening - Progressive lightening
    schedule(() => {
      console.log('[Bubble Sequence] ?? Step 7: Sky brightening');
      setBubbleStep('sky');
      setSkyLightnessLevel(3);
    }, GAP_BETWEEN_BUBBLES, 'sky');
    
    // S8: Gradient return - Sky transitions to dawn gradient
    schedule(() => {
      console.log('[Bubble Sequence] ?? Step 8: Gradient return - Full dawn');
      setBubbleStep('gradientReturn');
      setSkyLightnessLevel(4);
    }, SKY_STEP, 'gradient');
    
    // S9: CTA - Final call to action
    schedule(() => {
      console.log('[Bubble Sequence] ?? Step 9: CTA appears');
      setBubbleStep('cta');
      setLeoBubbleState('text');
    }, GRADIENT_RETURN, 'cta-fadeIn');
    
    // S10: Fade out CTA
    schedule(() => {
      console.log('[Bubble Sequence] ?? Step 10: CTA fading out');
      setLeoBubbleState('hidden');
      setBubbleStep('idle');
    }, FADE_IN + HOLD_TEXT + 800, 'cta-hide');
    
    // S11: Trigger transition to Moments Library
    schedule(() => {
      console.log('[Bubble Sequence] ?? Step 11: Transition to Moments Library');
      console.log('[Bubble Sequence] ? COMPLETE! Total sequence time:', (currentTime / 1000).toFixed(1), 'seconds');
      onComplete();
    }, 1200, 'transition');
    
    console.log('[Bubble Sequence] ?? Orchestration scheduled:', {
      totalSteps: timeouts.length,
      finalTimestamp: `${(currentTime / 1000).toFixed(1)}s`,
      poems: { poem1: !!poem1, poem2: !!poem2, poem3: !!poem3 },
      tips: { tip1: !!tips[0], tip2: !!tips[1], tip3: !!tips[2] },
    });
    
    return () => {
      // Cleanup all scheduled timeouts if component unmounts
      console.log('[Bubble Sequence] ?? Cleaning up', timeouts.length, 'scheduled timeouts');
      timeouts.forEach(timeout => clearTimeout(timeout));
      // DON'T reset orchestrationStartedRef here - it should stay true once started
      // to prevent re-triggering the sequence when state updates cause re-renders
    };
  }, [stage2Complete]); // onComplete removed - it's called once at end, doesn't need to trigger re-runs

  // Breathing helpers
  const isInhaling = breathProgress < 0.5;
  const skyBrightness = isInhaling ? 1.2 : 0.8;
  const leoScale = isInhaling ? 1.15 : 0.92;
  const starOpacity = isInhaling ? 0.9 : 0.3;

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
                opacity: { duration: isPrimary ? 0.5 : 1.5, delay: isPrimary ? 2 : 0 },
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
                      className="absolute -top-32 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-6xl font-bold z-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 2, ease: 'easeOut' } }}
                      transition={{ duration: 1, delay: 2.5 }}
                      style={{
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
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
                    style={{
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
          // Place words in safe horizontal bands: left (10-35%), right (65-90%)
          const angle = word.angle;
          const normalizedAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          
          // Determine safe vertical zone based on angle quadrant
          let x, y;
          
          if (normalizedAngle < Math.PI / 2) {
            // Top-right quadrant ? place in upper-right safe zone
            x = 65 + Math.random() * 20; // 65-85%
            y = 18 + Math.random() * 10; // 18-28% (below auth bar, above Leo)
          } else if (normalizedAngle < Math.PI) {
            // Bottom-right quadrant ? place in lower-right safe zone
            x = 65 + Math.random() * 20; // 65-85%
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else if (normalizedAngle < Math.PI * 1.5) {
            // Bottom-left quadrant ? place in lower-left safe zone
            x = 10 + Math.random() * 20; // 10-30%
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else {
            // Top-left quadrant ? place in upper-left safe zone
            x = 10 + Math.random() * 20; // 10-30%
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
              <span
                className="text-3xl md:text-3xl font-serif italic font-bold block"
                style={{
                  color: '#FFD700',
                  textShadow: `
                    0 0 20px #FFD700,
                    0 0 40px #FFD700,
                    0 0 60px #FFD70080,
                    0 4px 8px rgba(0,0,0,0.6)
                  `,
                  WebkitFontSmoothing: 'antialiased', // Improve mobile text rendering
                }}
              >
                {word.text}
              </span>
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
        
        // Leo bubble: Use center-based positioning since Leo is at left: 50%, top: 35%
        // This matches Leo's actual CSS positioning rather than relying on getBoundingClientRect
        // which can be affected by transforms
        const leoAnchor = {
          x: containerRect.width / 2, // Match left: 50%
          y: containerRect.height * 0.35 - 120, // Match top: 35%, offset up by ~120px to clear Leo
        };
        
        // Building/Tips bubble: top-left corner of building container
        // This ensures it's anchored to the visible building regardless of screen size
        const buildingAnchor = buildingRect ? {
          x: buildingRect.left - containerRect.left + 60, // 60px from left edge of building
          y: buildingRect.top - containerRect.top + 40, // 40px from top of building
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
                  : bubbleStep === 'cta' ? `If anything came to mind, write it down and feed it to ${pigName}.`
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
    </div>
  );

}



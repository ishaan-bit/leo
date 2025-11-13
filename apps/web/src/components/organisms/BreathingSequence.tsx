'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { type PrimaryEmotion, computeBreatheParams, FALLBACK_WORDS } from '@/lib/breathe-config';
import type { Stage2State, PostEnrichmentPayload, Stage2Phase, WindowState } from '@/lib/stage2-types';
import ComicBubble from '../atoms/ComicBubble';
import { translateToHindi } from '@/lib/translation';
import DialogueInterlude from './DialogueInterlude';
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

const MIN_CYCLES = 3;
const EASING = [0.42, 0, 0.58, 1] as const; // easeInOutSine

// Utility: Filter out non-English text (Hindi/Devanagari characters)
const isEnglishText = (text: string): boolean => {
  // Devanagari Unicode range: U+0900 to U+097F
  const devanagariRegex = /[\u0900-\u097F]/;
  return !devanagariRegex.test(text);
};

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
  const [firstCycleComplete, setFirstCycleComplete] = useState(false); // Track first breathing cycle
  
  // NEW: Transition states removed - seamless inheritance from CityInterlude
  const [showInhaleExhale, setShowInhaleExhale] = useState(false);
  
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
  const [showDialogueInterlude, setShowDialogueInterlude] = useState(false);
  
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

  // SEAMLESS from CityInterlude - no entrance orchestration needed
  // Buildings, sky, and moon already visible from previous scene
  useEffect(() => {
    // Start breathing immediately
    setShowInhaleExhale(true);
    setIsReady(true);
  }, []);

  // Start audio when breathing starts
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
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audio]);

  // Poll for Stage-2 enrichment (post_enrichment payload)
  // NOTE: ALL emotions (including null) get poems/tips orchestration
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
          console.log('[Stage2] dialogue_tuples:', postEnrichment.dialogue_tuples || postEnrichment.meta?.dialogue_tuples);
          console.log('[Stage2] dialogue_tuples count:', (postEnrichment.dialogue_tuples || postEnrichment.meta?.dialogue_tuples)?.length);
          
          setStage2Payload({
            dialogue_tuples: postEnrichment.dialogue_tuples || postEnrichment.meta?.dialogue_tuples,
            meta: postEnrichment.meta,
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

  // Continuous breathing animation loop with proper 4-phase cycle
  useEffect(() => {
    console.log('[Breathing] 🎬 Starting animation loop');
    console.log('[Breathing] Active cycle params:', activeCycle);
    
    // Reset startTime when breathing begins (only once)
    startTimeRef.current = Date.now();
    let frameCount = 0;
    
    const animate = () => {
      frameCount++;
      const elapsed = Date.now() - startTimeRef.current;
      const totalCycleDuration = (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2) * 1000;
      const cyclePosition = (elapsed % totalCycleDuration) / totalCycleDuration;
      
      // Calculate breath progress with 4 phases: inhale -> hold1 -> exhale -> hold2
      const inDuration = activeCycle.in / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
      const h1Duration = activeCycle.h1 / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
      const outDuration = activeCycle.out / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
      
      const phase1End = inDuration;
      const phase2End = inDuration + h1Duration;
      const phase3End = inDuration + h1Duration + outDuration;
      
      // Determine current phase for logging
      const currentPhase = cyclePosition < phase1End ? 'inhale'
        : cyclePosition < phase2End ? 'hold-in'
        : cyclePosition < phase3End ? 'exhale'
        : 'hold-out';
      
      // Log every 60 frames (roughly once per second at 60fps)
      if (frameCount % 60 === 0) {
        console.log(`[Breathing] 🔄 Frame ${frameCount} | Phase: ${currentPhase} | Progress: ${(cyclePosition * 100).toFixed(1)}% | Elapsed: ${(elapsed / 1000).toFixed(1)}s`);
      }
      
      setBreathProgress(cyclePosition);
      
      // Count completed cycles
      const currentCycle = Math.floor(elapsed / totalCycleDuration);
      if (currentCycle > cycleCount) {
        setCycleCount(currentCycle);
        console.log('[Breathing] ✅ Cycle', currentCycle, 'complete');
        
        // Mark first cycle complete after one full inhale/hold/exhale/hold
        if (currentCycle >= 1 && !firstCycleComplete) {
          setFirstCycleComplete(true);
          console.log('[Breathing] ✅ First breathing cycle complete - ready for DialogueInterlude');
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      console.log('[Breathing] 🛑 Stopping animation loop - ran for', frameCount, 'frames');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeCycle.in, activeCycle.h1, activeCycle.out, activeCycle.h2, cycleCount, firstCycleComplete]); // FIXED: Depend on primitive values not object reference

  // NEW ORCHESTRATION: Check for dialogue_tuples and trigger DialogueInterlude
  // WAIT for transition phases to complete AND one breathing cycle
  // CRITICAL: This must re-check whenever ANY dependency changes (not just when tuples arrive)
  useEffect(() => {
    if (!stage2Complete || !stage2Payload) {
      console.log('[BreathingSequence] ⏳ Waiting for stage2 completion...', {
        stage2Complete,
        hasPayload: !!stage2Payload,
      });
      return;
    }
    
    if (orchestrationStartedRef.current) {
      console.log('[BreathingSequence] ℹ️ Orchestration already started, skipping');
      return;
    }
    
    // Check if we have dialogue_tuples from Excel system
    const dialogueTuples = stage2Payload.dialogue_tuples || stage2Payload.meta?.dialogue_tuples;
    
    if (!dialogueTuples || dialogueTuples.length < 3) {
      console.error('[BreathingSequence] ❌ No dialogue tuples found in post_enrichment!');
      console.error('[BreathingSequence] Stage2 payload:', stage2Payload);
      return;
    }
    
    // Log state every time this effect runs (helps debug timing issues)
    console.log('[BreathingSequence] 🔍 Checking DialogueInterlude trigger conditions:', {
      tupleCount: dialogueTuples.length,
      firstCycleComplete,
      readyToTrigger: firstCycleComplete,
    });
    
    // Only trigger if condition is met
    if (firstCycleComplete) {
      console.log('[BreathingSequence] ✅ Ready to start DialogueInterlude');
      console.log('[BreathingSequence] Tuples:', dialogueTuples);
      
      orchestrationStartedRef.current = true;
      
      // Brief delay to let breathing settle
      setTimeout(() => {
        console.log('[BreathingSequence] 🎭 Starting DialogueInterlude NOW');
        setShowDialogueInterlude(true);
      }, 500);
    } else {
      // Log what we're waiting for
      if (!firstCycleComplete) {
        console.log('[BreathingSequence] ⏳ Waiting for first breathing cycle to complete');
      }
    }
  }, [stage2Complete, stage2Payload, firstCycleComplete]);

  // Breathing helpers - 4-phase cycle: inhale -> hold1 -> exhale -> hold2
  const inDuration = activeCycle.in / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
  const h1Duration = activeCycle.h1 / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
  const outDuration = activeCycle.out / (activeCycle.in + activeCycle.h1 + activeCycle.out + activeCycle.h2);
  
  const phase1End = inDuration;
  const phase2End = inDuration + h1Duration;
  const phase3End = inDuration + h1Duration + outDuration;
  
  // Determine current phase
  const currentPhase = breathProgress < phase1End ? 'inhale'
    : breathProgress < phase2End ? 'hold-in'
    : breathProgress < phase3End ? 'exhale'
    : 'hold-out';
  
  const isInhaling = currentPhase === 'inhale';
  const isExhaling = currentPhase === 'exhale';
  const isHoldingIn = currentPhase === 'hold-in';
  const isHoldingOut = currentPhase === 'hold-out';
  
  const skyBrightness = (isInhaling || isHoldingIn) ? 1.2 : 0.8;
  
  // REVERTED: Keep pig's original simple pulse (better animation feel)
  // Text 'inhale'/'exhale' should sync to THIS, not the other way around
  const leoScale = (isInhaling || isHoldingIn) ? 1.15 : 0.92;
  
  const starOpacity = (isInhaling || isHoldingIn) ? 0.9 : 0.3;
  
  // Handle "Mark Done" button click - advances to next poem/tip cycle
  const handleMarkDone = (tipIndex: number) => {
    console.log(`[Breathing] 🎯 Mark Done clicked for tip ${tipIndex + 1}`);
    
    // Immediately disable button to prevent double clicks
    setShowMarkDoneButton(false);
    
    // Hide the speech bubble when mark done is clicked
    setLeoBubbleState('ellipsis');
    setTimeout(() => {
      setLeoBubbleState('hidden');
    }, 400);
    
    // Track this tip as marked
    setMarkedTips(prev => [...prev, tipIndex + 1]);
    
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

  // NEW: If dialogue tuples available, show DialogueInterlude instead of breathing sequence
  if (showDialogueInterlude && stage2Payload) {
    const dialogueTuples = stage2Payload.dialogue_tuples || stage2Payload.meta?.dialogue_tuples;
    
    if (dialogueTuples && dialogueTuples.length >= 3) {
      // Get tower config for primary emotion
      const primaryTower = TOWERS.find(t => t.id === effectivePrimary);
      
      return (
        <DialogueInterlude
          tuples={dialogueTuples as Array<[string, string, string]>}
          pigName={pigName}
          zoneColor={color}
          towerConfig={primaryTower ? {
            name: primaryTower.name,
            color: primaryTower.color,
            x: primaryTower.x, // Use original position, NOT getPrimaryTowerX
            height: primaryTower.height,
          } : undefined}
          onComplete={onComplete}
        />
      );
    }
  }

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
            scale: { 
              duration: isInhaling ? activeCycle.in : isExhaling ? activeCycle.out : 0.3,
              ease: EASING,
            },
            rotateZ: leoReacting 
              ? { duration: 0.7, times: [0, 0.33, 0.66, 1], ease: 'easeInOut' }
              : { duration: 0.3, ease: 'easeOut' }
          }}
        >
          <Image src="/images/leo.svg" alt="Leo" width={200} height={200} priority />
        </motion.div>
      </motion.div>

      {/* Breathing prompt - positioned below Leo - Shows throughout breathing phase */}
      {/* Continuous inhale/exhale text that transitions smoothly */}
      <AnimatePresence>
        {showInhaleExhale && (!stage2Complete || cycleCount < 1) && (
          <motion.div
            className="absolute left-1/2 z-30 pointer-events-none"
            style={{
              x: '-50%',
              top: 'calc(28% + 160px)', // Below Leo
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1,
              // Pulse with breathing - grow on inhale, shrink on exhale
              scale: isInhaling || isHoldingIn ? 1.15 : 0.9,
            }}
            transition={{ 
              opacity: { duration: 0.5, ease: 'easeOut' },
              scale: {
                duration: isInhaling ? activeCycle.in : isExhaling ? activeCycle.out : 0.5,
                ease: EASING,
              }
            }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.5, ease: 'easeOut' } }}
          >
            {/* Show inhale or exhale - always visible, smooth transitions */}
            <motion.div
              key={isInhaling || isHoldingIn ? 'inhale' : 'exhale'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="text-2xl font-sans tracking-widest lowercase font-light"
              style={{
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: `
                  0 0 20px rgba(255, 255, 255, 0.8),
                  0 0 40px rgba(255, 255, 255, 0.6),
                  0 2px 8px rgba(0,0,0,0.4)
                `,
                letterSpacing: '0.35em',
              }}
            >
              {isInhaling || isHoldingIn ? 'inhale' : 'exhale'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2 Complete: No poem displayed - clean visual hold state */}
      {/* Sky, building, Leo, and ambient pulse continue */}
      {/* All text has faded out above */}

      {/* City skyline with towers - primary repositioned to center-left */}
      {/* START with ALL buildings visible and pulsing (from CityInterlude) */}
      {/* Then fade non-primary, then center primary */}
      {primary && (
        <motion.div
          ref={buildingContainerRef}
          className="absolute bottom-0 left-0 right-0 z-25"
          style={{ height: '50vh' }}
        >
          {TOWERS.map(tower => {
            const isPrimary = tower.id === primary;
            
            // SEAMLESS: Inherit buildings from CityInterlude - fade non-primary, keep all visible
            const towerOpacity = isPrimary ? 1 : 0.3; // Fade non-primary slightly
            const displayX = tower.x; // Keep original positions
          
          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${displayX}%`,
                width: '80px',
                height: `${tower.height * 1.8}px`,
              }}
              initial={{ opacity: 1, scale: 1 }} // Inherit fully visible state from CityInterlude
              animate={{
                opacity: towerOpacity,
                scale: isPrimary ? ((isInhaling || isHoldingIn) ? 1.02 : 0.98) : 1,
              }}
              transition={{ 
                opacity: { 
                  duration: 2, // Gentle fade
                  ease: 'easeInOut',
                },
                scale: { 
                  duration: isInhaling ? activeCycle.in : isExhaling ? activeCycle.out : 0.3,
                  ease: EASING 
                }
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

                {/* Building name - visible during first cycle and stage2, fade when transitioning */}
                <AnimatePresence>
                  {isPrimary && !stage2Complete && (
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-5xl md:text-6xl font-bold z-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 2, ease: 'easeOut' } }}
                      transition={{ duration: 1.5, delay: 0.5 }}
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

                {/* Breathing halo - pulses with breath rhythm */}
                {isPrimary && isReady && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
                    style={{
                      top: '-10rem', // Match building name position
                      background: `radial-gradient(circle, ${tower.color}66 0%, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                    animate={{ 
                      scale: isInhaling || isHoldingIn ? 1.4 : 0.8,
                      opacity: isInhaling || isHoldingIn ? 1 : 0.6,
                    }}
                    transition={{ 
                      scale: {
                        duration: isInhaling ? activeCycle.in : isExhaling ? activeCycle.out : 0.5,
                        ease: EASING,
                      },
                      opacity: {
                        duration: isInhaling ? activeCycle.in : isExhaling ? activeCycle.out : 0.5,
                        ease: EASING,
                      },
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      )}

      {/* Moon - shown ONLY when primary is null/none - CENTERED vertically and horizontally */}
      {!primary && isReady && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: 1,
            scale: isInhaling ? 1.05 : 0.95,
          }}
          transition={{
            opacity: { duration: 2, ease: 'easeInOut' },
            scale: { 
              duration: isInhaling ? activeCycle.in : activeCycle.out,
              ease: EASING 
            }
          }}
        >
          {/* Moon glow - WHITE not purple */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
              filter: 'blur(30px)',
            }}
          />
          
          {/* Moon body - PURE WHITE crescent */}
          <div
            className="relative rounded-full"
            style={{
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #F8F8FF 50%, #F0F0F8 100%)',
              boxShadow: `
                inset -10px -10px 20px rgba(0,0,0,0.08),
                0 0 50px rgba(255,255,255,0.6),
                0 0 100px rgba(255,255,255,0.4)
              `,
            }}
          />
        </motion.div>
      )}

      {/* Floating poem - shows complete line, floats upward like smoke - 11s duration with breathing pulse */}
      <AnimatePresence>
        {floatingPoem && (
          <motion.div
            key={floatingPoem.id}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
            initial={{ opacity: 0, y: 0, scale: 0.9 }}
            animate={{ 
              opacity: [0, 1, 1, 1, 0.7, 0],
              y: [0, -50, -120, -200, -300, -400],
              scale: [0.9, 1, 1.02, 1.05, 1.08, 1.1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 11, // Extended from 6s to 11s
              times: [0, 0.1, 0.4, 0.7, 0.9, 1],
              ease: [0.4, 0, 0.2, 1], // easeInOutCirc
            }}
          >
            {/* Add breathing pulse effect to floating words */}
            <motion.div
              animate={{
                scale: isInhaling ? [1, 1.05] : [1.05, 1],
              }}
              transition={{
                duration: activeCycle.in,
                ease: EASING,
              }}
            >
              <div
                className="text-xl md:text-2xl font-serif italic font-medium text-center leading-relaxed px-8 max-w-2xl"
                style={{
                  color: '#FFD700',
                  textShadow: `
                    0 0 20px #FFD700,
                    0 0 40px #FFD700,
                    0 0 60px #FFD70080,
                    0 4px 12px rgba(0,0,0,0.4)
                  `,
                  WebkitFontSmoothing: 'antialiased',
                }}
              >
                {floatingPoem.text}
              </div>
            </motion.div>
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
            {/* Leo Bubble - LEGACY: Only used if fallback orchestration runs */}
            {leoAnchor && leoBubbleState !== 'hidden' && (
              <ComicBubble
                content=""  // Legacy tip system removed
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
      
      {/* Mark Done button - sleek, refined Ghibli style */}
      <AnimatePresence>
        {showMarkDoneButton && (
          <motion.div
            className="fixed bottom-8 z-60 w-full flex justify-center items-center px-4"
            style={{
              left: 0,
              right: 0,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.button
              onClick={() => handleMarkDone(currentTipIndex)}
              className="relative px-6 py-2.5 rounded-full bg-white/90 backdrop-blur-md text-[#6B8E6A] shadow-[0_4px_20px_rgba(107,142,106,0.2)] border border-[#8BA888]/30 overflow-hidden"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 6px 25px rgba(107,142,106,0.3)',
              }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              {/* Subtle shimmer */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Button content */}
              <div className="relative flex items-center gap-2">
                <span className="text-base">→</span>
                <span 
                  className="text-sm font-light tracking-wide"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Continue
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}
        
        {/* Completion feedback */}
        {markedTips.includes(currentTipIndex + 1) && showMarkDoneButton === false && (
          <motion.div
            className="fixed bottom-8 left-0 right-0 z-60 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-white/95 backdrop-blur-md px-6 py-2.5 rounded-full shadow-[0_4px_20px_rgba(107,142,106,0.15)] border border-[#8BA888]/20">
              <p className="text-[#6B8E6A] font-light flex items-center gap-2 text-sm" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                <motion.span 
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  ✓
                </motion.span>
                <span>Noted</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}



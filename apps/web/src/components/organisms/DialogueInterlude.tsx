/**
 * DialogueInterlude - 3-Part Tuple Display (Excel Dialogue System)
 * 
 * Implements the spec EXACTLY as provided:
 * 
 * Each tuple has 3 parts: ["Inner Voice", "Regulate", "Amuse"]
 * 
 * Phase Flow PER TUPLE:
 * 1. Inner Voice - Floating text above city (fades in 5s, fades out)
 * 2. Regulate - Pig speech bubble (appears after Inner Voice, persists)
 * 3. Amuse - Window/building bubble (appears alongside Regulate, persists)
 * 4. "Proceed" button - Fades in after Amuse settles (+2s delay)
 * 
 * After clicking Proceed:
 * - Fade out all bubbles + button
 * - Transition to next tuple (repeat 3x)
 * - After 3rd tuple → Living City
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ComicSpeechBubble from '../atoms/ComicSpeechBubble';
import FloatingWords from '../atoms/FloatingWords';
import { MOTION_DURATION, NATURAL_EASE } from '@/lib/motion-tokens';

interface DialogueInterludeProps {
  /** 3 dialogue tuples: [[Inner, Regulate, Amuse], ...] */
  tuples: Array<[string, string, string]>;
  
  /** Pig name for display */
  pigName: string;
  
  /** Primary emotion color */
  zoneColor: string;
  
  /** Tower configuration for visual consistency */
  towerConfig?: {
    name: string;
    color: string;
    x: number;
    height: number;
  };
  
  /** Callback when all 3 tuples complete */
  onComplete: () => void;
}

// Use global NATURAL_EASE from motion tokens instead of local constant

type TuplePhase = 
  | 'idle'
  | 'inner_voice'  // Floating text above city
  | 'regulate'     // Pig speech bubble appears
  | 'amuse'        // Window bubble appears
  | 'proceed'      // Proceed button visible
  | 'transition';  // Fading out, moving to next

export default function DialogueInterlude({
  tuples,
  pigName,
  zoneColor,
  towerConfig,
  onComplete,
}: DialogueInterludeProps) {
  const [currentTupleIndex, setCurrentTupleIndex] = useState(0);
  const [phase, setPhase] = useState<TuplePhase>('idle');
  const [showPigBubble, setShowPigBubble] = useState(false);
  const [showWindowBubble, setShowWindowBubble] = useState(false);
  const [showProceedButton, setShowProceedButton] = useState(false);
  
  // NEW: Sky darkening progress (0 = Ghibli sky, 1 = deep night)
  // Smoothly interpolates across all 3 tuples + phases
  const [skyDarkenProgress, setSkyDarkenProgress] = useState(0);
  
  const leoContainerRef = useRef<HTMLDivElement>(null);
  const orchestrationStartedRef = useRef(false);
  
  // Helper: Lerp between two hex colors
  const lerpColor = (color1: string, color2: string, t: number) => {
    const hex = (c: string) => parseInt(c.substring(1), 16);
    const c1 = hex(color1);
    const c2 = hex(color2);
    
    const r1 = (c1 >> 16) & 255;
    const g1 = (c1 >> 8) & 255;
    const b1 = c1 & 255;
    
    const r2 = (c2 >> 16) & 255;
    const g2 = (c2 >> 8) & 255;
    const b2 = c2 & 255;
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  
  // Compute sky gradient based on darkening progress
  const getSkyGradient = () => {
    // Ghibli sky from CityInterlude/BreathingSequence
    const ghibliTop = '#3A2952';
    const ghibliBottom = '#6B5B95';
    
    // Deep night sky for dialogue end
    const nightTop = '#0A0714';
    const nightBottom = '#1A1530';
    
    // Smooth cubic easing for natural darkening
    const eased = skyDarkenProgress * skyDarkenProgress * (3 - 2 * skyDarkenProgress);
    
    const topColor = lerpColor(ghibliTop, nightTop, eased);
    const bottomColor = lerpColor(ghibliBottom, nightBottom, eased);
    
    return `linear-gradient(180deg, ${topColor} 0%, ${bottomColor} 100%)`;
  };
  
  // Validate tuples
  useEffect(() => {
    if (tuples.length < 3) {
      console.error('[DialogueInterlude] ❌ Less than 3 tuples provided:', tuples.length);
    }
    
    tuples.forEach((tuple, i) => {
      if (tuple.length !== 3) {
        console.error(`[DialogueInterlude] ❌ Tuple ${i} does not have 3 parts:`, tuple);
      }
    });
  }, [tuples]);
  
  // Start orchestration for current tuple
  useEffect(() => {
    if (orchestrationStartedRef.current) return;
    if (currentTupleIndex >= tuples.length) return;
    
    orchestrationStartedRef.current = true;
    const tuple = tuples[currentTupleIndex];
    
    console.log(`[DialogueInterlude] 🎬 Starting tuple ${currentTupleIndex + 1}/3`);
    console.log(`[DialogueInterlude] Inner Voice: "${tuple[0]}"`);
    console.log(`[DialogueInterlude] Regulate: "${tuple[1]}"`);
    console.log(`[DialogueInterlude] Amuse: "${tuple[2]}"`);
    
    // Phase 1: Inner Voice (floating text)
    setTimeout(() => {
      console.log(`[DialogueInterlude] Phase 1: Inner Voice - "${tuple[0]}"`);
      setPhase('inner_voice');
      
      // Inner Voice fades in, hovers 5s, fades out
      setTimeout(() => {
        console.log(`[DialogueInterlude] Phase 2: Regulate - "${tuple[1]}"`);
        setPhase('regulate');
        
        // Phase 2: Pig bubble appears
        setTimeout(() => {
          console.log('[DialogueInterlude] Showing pig bubble');
          setShowPigBubble(true);
          
          // Phase 3: Window bubble appears (alongside pig bubble)
          setTimeout(() => {
            console.log(`[DialogueInterlude] Phase 3: Amuse - "${tuple[2]}"`);
            setPhase('amuse');
            setShowWindowBubble(true);
            
            // Phase 4: Proceed button fades in (2s delay after Amuse)
            setTimeout(() => {
              console.log('[DialogueInterlude] Phase 4: Proceed button ready');
              setPhase('proceed');
              setShowProceedButton(true);
            }, 2000);
          }, 2000); // 2s after Regulate
        }, 500);
      }, 5000); // Inner Voice duration
    }, 500);
  }, [currentTupleIndex, tuples]);
  
  // Smoothly update sky darkening progress based on tuple index and phase
  // Progress: 0 (tuple 0 start) → 1 (tuple 2 end)
  useEffect(() => {
    // Calculate base progress from tuple index (0, 1, 2 → 0, 0.33, 0.66)
    const tupleProgress = currentTupleIndex / 3;
    
    // Add phase-based progress within current tuple
    const phaseWeights: Record<TuplePhase, number> = {
      'idle': 0,
      'inner_voice': 0.08,   // 0-8% of tuple
      'regulate': 0.16,      // 8-16% of tuple
      'amuse': 0.24,         // 16-24% of tuple
      'proceed': 0.33,       // 24-33% of tuple (full tuple done)
      'transition': 0.33,
    };
    
    const phaseOffset = phaseWeights[phase] || 0;
    const targetProgress = Math.min(1, tupleProgress + phaseOffset);
    
    // Smooth transition to target progress
    setSkyDarkenProgress(targetProgress);
    
    console.log(`[DialogueInterlude] 🌌 Sky darken: ${(targetProgress * 100).toFixed(1)}% (tuple ${currentTupleIndex + 1}, phase ${phase})`);
  }, [currentTupleIndex, phase]);
  
  // Handle Proceed button click
  const handleProceed = () => {
    console.log(`[DialogueInterlude] ✅ Proceed clicked for tuple ${currentTupleIndex + 1}`);
    
    setPhase('transition');
    setShowProceedButton(false);
    
    // Fade out bubbles
    setTimeout(() => {
      setShowPigBubble(false);
      setShowWindowBubble(false);
      
      // Move to next tuple or complete
      setTimeout(() => {
        if (currentTupleIndex < tuples.length - 1) {
          // Next tuple
          setCurrentTupleIndex(prev => prev + 1);
          setPhase('idle');
          orchestrationStartedRef.current = false;
        } else {
          // All tuples complete
          console.log('[DialogueInterlude] 🎉 All 3 tuples complete, transitioning to Living City');
          onComplete();
        }
      }, 1000);
    }, 500);
  };
  
  const currentTuple = tuples[currentTupleIndex] || ['', '', ''];
  const [innerVoice, regulate, amuse] = currentTuple;
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* SMOOTH Sky Gradient - starts at Ghibli, gradually darkens through tuples */}
      {/* NO discrete cuts, NO flickering, SEAMLESS from BreathingSequence */}
      <motion.div 
        className="absolute inset-0 -z-10"
        animate={{
          background: getSkyGradient(),
        }}
        transition={{
          duration: 2, // 2 second smooth transitions between gradient states
          ease: [0.4, 0, 0.2, 1], // Cubic bezier for natural easing
        }}
      />
      
      {/* Stars - inherited from breathing sequence aesthetic */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => {
          const x = Math.random() * 100;
          const y = Math.random() * 70;
          const size = 1 + Math.random() * 2;
          const baseOpacity = 0.3 + Math.random() * 0.4;
          const delay = Math.random() * 3;
          
          return (
            <motion.div
              key={`star-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
              animate={{ 
                opacity: [baseOpacity * 0.5, baseOpacity, baseOpacity * 0.5],
                scale: [1, 1.2, 1],
              }}
              transition={{
                opacity: { duration: 2.5 + delay, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 2.5 + delay, repeat: Infinity, ease: 'easeInOut' },
              }}
            />
          );
        })}
      </div>
      
      {/* Moon is already in CityInterlude and BreathingSequence - removed to avoid duplicate */}
      
      {/* Primary Tower - locked position from BreathingSequence */}
      {towerConfig && (
        <motion.div
          className="absolute bottom-0 z-20"
          style={{
            left: `${towerConfig.x}%`, // FIXED: Use towerConfig.x (35%) from BreathingSequence
            transform: 'none', // No centering transform to avoid position change
            width: '80px',
            height: `${towerConfig.height * 1.8}px`,
          }}
          initial={{ opacity: 1, scale: 0.98 }} // Match breathing sequence exhale state
          animate={{ opacity: 1, scale: 1 }} // Gently return to normal scale
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Tower body */}
          <div
            className="w-full h-full relative"
            style={{
              background: `linear-gradient(180deg, ${towerConfig.color}50 0%, ${towerConfig.color}25 60%, ${towerConfig.color}15 100%)`,
              border: `1px solid ${towerConfig.color}40`,
              borderRadius: '2px 2px 0 0',
            }}
          >
            {/* Windows grid - breathing pulse */}
            <div className="absolute inset-4 grid grid-cols-4 gap-2">
              {Array.from({ length: Math.floor((towerConfig.height * 1.8) / 25) * 4 }).map((_, i) => {
                const breathPattern = Math.random();
                const baseDelay = i * 0.15;
                const cycleDuration = 2.5 + breathPattern * 3.5;
                const minOpacity = 0.15 + (breathPattern * 0.15);
                const maxOpacity = 0.4 + (breathPattern * 0.3);
                
                return (
                  <motion.div
                    key={`window-${i}`}
                    className="rounded-[1px]"
                    animate={{
                      backgroundColor: [
                        `rgba(248, 216, 181, ${minOpacity})`,
                        `rgba(255, 230, 200, ${maxOpacity})`,
                        `rgba(248, 216, 181, ${minOpacity})`,
                      ],
                    }}
                    transition={{
                      duration: cycleDuration,
                      repeat: Infinity,
                      delay: baseDelay,
                      ease: 'easeInOut',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Inner Voice - Floating text mid-screen with gentle fade loop */}
      <AnimatePresence>
        {phase === 'inner_voice' && innerVoice && (
          <motion.div
            className="absolute top-[35%] left-1/2 z-40 text-center px-6"
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ 
              opacity: [0, 1, 1, 0.7, 1, 1, 0],
              y: [30, 0, -5, -10, -15, -20, -30],
              x: '-50%',
            }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ 
              duration: 5,
              times: [0, 0.15, 0.4, 0.6, 0.75, 0.9, 1],
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <p
              className="text-xl md:text-2xl lg:text-3xl font-serif italic leading-relaxed max-w-2xl"
              style={{
                color: '#FFD700', // Golden color like floating words in breathing
                textShadow: `
                  0 0 20px #FFD700,
                  0 0 40px #FFD700,
                  0 0 60px #FFD70080,
                  0 4px 12px rgba(0,0,0,0.4)
                `,
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              {innerVoice}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Pig Character - Match BreathingSequence position (top 28%, centered) */}
      {/* CRITICAL: Continue breathing animation seamlessly from BreathingSequence */}
      <div
        ref={leoContainerRef}
        className="absolute left-1/2 top-[28%] z-30"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <motion.div
          animate={{ 
            scale: [0.98, 1.02, 0.98], // Continuous gentle breathing pulse (matches BreathingSequence rhythm)
          }}
          transition={{
            duration: 4, // 4s breathing cycle (2s inhale, 2s exhale)
            repeat: Infinity,
            ease: NATURAL_EASE,
          }}
        >
          <Image 
            src="/images/leo.svg" 
            alt={pigName} 
            width={200} 
            height={200} 
            priority 
          />
        </motion.div>
      </div>
      
      {/* Regulate - Pig speech bubble (anchored to Leo pig character, closer to left side) */}
      <AnimatePresence>
        {showPigBubble && regulate && (
          <motion.div
            className="absolute z-40"
            style={{
              top: 'calc(28% - 50px)', // Top-right of Leo (who is at top: 28%)
              left: 'calc(50% + 60px)', // MOVED CLOSER: was +100px, now +60px (40px closer to pig)
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: NATURAL_EASE }}
          >
            <ComicSpeechBubble
              content={regulate}
              variant="pig" 
              maxWidth={280} // INCREASED: was 240, now 280 for minimum 3 words per line
              tailDirection="left" // Tail points left toward Leo
              tailOffsetY={30} // Position tail toward upper part of bubble
              shadowLevel={2}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Amuse - Window bubble (points to glowing window in top floor of building) */}
      <AnimatePresence>
        {showWindowBubble && amuse && towerConfig && (
          <>
            {/* NO GLOWING WINDOW - removed per user request */}

            
            {/* Floating words rising from building */}
            <FloatingWords
              words={[amuse]}
              startY={`${(towerConfig.height * 1.8) - 60}px`}
              startX={`${Math.max(15, Math.min(85, towerConfig.x))}%`} // Clamp to 15-85% safe area
              floatDistance={140}
              maxConcurrent={2}
              enabled={true}
            />
            
            {/* Bubble pointing to top-left window */}
            <motion.div
              className="absolute z-40"
              style={{
                bottom: `${(towerConfig.height * 1.8) - 20}px`, // Near top floor
                left: `${towerConfig.x}%`,
                transform: 'translateX(-100px)', // Offset to the left of building
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.35,
                ease: NATURAL_EASE,
              }}
            >
              <ComicSpeechBubble
                content={amuse}
                variant="window"
                tailDirection="right"
                tailOffsetY={30}
                shadowLevel={2}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Proceed button - bottom centered with progressive messages */}
      <AnimatePresence>
        {showProceedButton && (
          <motion.div
            className="absolute bottom-[8%] left-0 right-0 z-50 flex justify-center"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 1, ease: NATURAL_EASE }}
          >
            <motion.button
              onClick={() => {
                // Play chime sound (reuse from breathing sequence)
                const chime = new Audio('/audio/chime.mp3');
                chime.volume = 0.5;
                chime.play().catch(() => {});
                handleProceed();
              }}
              className="px-6 py-2 rounded-full font-serif text-sm shadow-xl whitespace-nowrap [@media(hover:hover)]:hover:scale-105 [@media(hover:hover)]:hover:-translate-y-0.5 transition-transform duration-[120ms]"
              style={{
                background: `linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, ${zoneColor}10 100%)`,
                backdropFilter: 'blur(20px)',
                border: `2px solid ${zoneColor}30`,
                color: '#2D2D2D',
                boxShadow: `0 4px 20px ${zoneColor}20`,
              }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow: [
                  `0 4px 20px ${zoneColor}20`,
                  `0 6px 30px ${zoneColor}30`,
                  `0 4px 20px ${zoneColor}20`,
                ],
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: NATURAL_EASE,
                },
                scale: {
                  duration: MOTION_DURATION.EMPHASIS, // 120ms tap feedback
                  ease: NATURAL_EASE,
                }
              }}
            >
              {currentTupleIndex === 0 ? "On We Go" : currentTupleIndex === 1 ? "One More Breath" : "And So it Goes"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Progress indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {tuples.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-500"
            style={{
              background: i <= currentTupleIndex ? zoneColor : '#ccc',
              opacity: i <= currentTupleIndex ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}

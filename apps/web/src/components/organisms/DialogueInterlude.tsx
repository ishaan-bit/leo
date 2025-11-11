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
import ComicBubble from '../atoms/ComicBubble';

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

const EASING = [0.42, 0, 0.58, 1] as const;

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
  
  const leoContainerRef = useRef<HTMLDivElement>(null);
  const orchestrationStartedRef = useRef(false);
  
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
      setPhase('inner_voice');
      
      // Inner Voice fades in, hovers 5s, fades out
      setTimeout(() => {
        setPhase('regulate');
        
        // Phase 2: Pig bubble appears
        setTimeout(() => {
          setShowPigBubble(true);
          
          // Phase 3: Window bubble appears (alongside pig bubble)
          setTimeout(() => {
            setPhase('amuse');
            setShowWindowBubble(true);
            
            // Phase 4: Proceed button fades in (2s delay after Amuse)
            setTimeout(() => {
              setPhase('proceed');
              setShowProceedButton(true);
            }, 2000);
          }, 2000); // 2s after Regulate
        }, 500);
      }, 5000); // Inner Voice duration
    }, 500);
  }, [currentTupleIndex, tuples]);
  
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
      {/* Gradient background */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, ${zoneColor}15 100%)`,
        }}
      />
      
      {/* Inner Voice - Floating text above city */}
      <AnimatePresence>
        {phase === 'inner_voice' && innerVoice && (
          <motion.div
            className="absolute top-[20%] left-1/2 z-40 text-center px-6"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 1.5, ease: EASING }}
          >
            <p
              className="text-2xl md:text-3xl font-serif italic leading-relaxed max-w-2xl"
              style={{
                color: zoneColor,
                textShadow: '0 2px 20px rgba(0,0,0,0.1)',
              }}
            >
              {innerVoice}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Pig Character - Center bottom */}
      <div
        ref={leoContainerRef}
        className="absolute bottom-[15%] left-1/2 -translate-x-1/2 z-30"
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: EASING }}
        >
          <motion.div
            animate={{
              scale: showPigBubble ? 1.05 : 1,
            }}
            transition={{ duration: 0.7, ease: EASING }}
          >
            <Image 
              src="/images/leo.svg" 
              alt={pigName} 
              width={180} 
              height={180} 
              priority 
            />
          </motion.div>
        </motion.div>
      </div>
      
      {/* Regulate - Pig speech bubble */}
      <AnimatePresence>
        {showPigBubble && regulate && (
          <motion.div
            className="absolute z-40"
            style={{
              bottom: leoContainerRef.current 
                ? `calc(15% + ${leoContainerRef.current.offsetHeight}px + 20px)`
                : '50%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.6, ease: EASING }}
          >
            <ComicBubble
              text={regulate}
              mood="calm"
              variant="speech"
              maxWidth={600}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Amuse - Window/building bubble */}
      <AnimatePresence>
        {showWindowBubble && amuse && towerConfig && (
          <motion.div
            className="absolute z-35"
            style={{
              bottom: '25%',
              left: `${towerConfig.x}%`,
              transform: 'translateX(-50%)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: EASING, delay: 0.2 }}
          >
            <div
              className="px-4 py-3 rounded-xl shadow-xl max-w-xs text-center"
              style={{
                background: `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, ${towerConfig.color}20 100%)`,
                backdropFilter: 'blur(10px)',
                border: `2px solid ${towerConfig.color}30`,
                boxShadow: `0 8px 30px ${towerConfig.color}20`,
              }}
            >
              <p className="text-sm md:text-base font-sans leading-relaxed" style={{ color: '#2D2D2D' }}>
                {amuse}
              </p>
            </div>
            
            {/* Arrow pointing to window */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: `10px solid ${towerConfig.color}30`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Proceed button */}
      <AnimatePresence>
        {showProceedButton && (
          <motion.div
            className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 1.5, ease: EASING }}
          >
            <motion.button
              onClick={handleProceed}
              className="px-8 py-3 rounded-full font-serif text-base md:text-lg shadow-xl"
              style={{
                background: `linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, ${zoneColor}10 100%)`,
                backdropFilter: 'blur(20px)',
                border: `2px solid ${zoneColor}30`,
                color: '#2D2D2D',
                boxShadow: `0 4px 20px ${zoneColor}20`,
              }}
              whileHover={{ scale: 1.05, y: -2 }}
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
                  ease: 'easeInOut',
                },
              }}
            >
              {currentTupleIndex < tuples.length - 1 ? "That helps." : "I'm ready."}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Tower silhouette for context (optional) */}
      {towerConfig && (
        <div
          className="absolute bottom-0 z-20 opacity-20"
          style={{
            left: `${towerConfig.x}%`,
            transform: 'translateX(-50%)',
            width: '60px',
            height: `${towerConfig.height}px`,
            background: `linear-gradient(180deg, ${towerConfig.color}40 0%, ${towerConfig.color}15 100%)`,
            borderRadius: '2px 2px 0 0',
          }}
        />
      )}
      
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

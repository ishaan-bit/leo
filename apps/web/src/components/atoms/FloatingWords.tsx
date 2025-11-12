/**
 * FloatingWords - Gentle rising text effect above buildings
 * 
 * Inspired by comic panel aesthetics - words drift upward from building tops,
 * fade out below Leo's chin, and never cover his face.
 * 
 * Features:
 * - 3-6s float duration with gentle easing
 * - 100% → 0% opacity fade
 * - Slight horizontal drift (2-6px) and subtle scale up (1-2%)
 * - Staggered spawning (max 3 concurrent)
 * - Warm yellow glow matching reference
 * - GPU-accelerated (transform + opacity only)
 * - Respects prefers-reduced-motion
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

interface FloatingWordsProps {
  /** Words/phrases to display */
  words: string[];
  
  /** Starting Y position (% or px) */
  startY: number | string;
  
  /** Starting X position (% or px) */
  startX: number | string;
  
  /** How far to float upward (px) */
  floatDistance?: number;
  
  /** Max concurrent floating words */
  maxConcurrent?: number;
  
  /** Enable/disable feature */
  enabled?: boolean;
}

const EASING = [0.4, 0, 0.2, 1] as const;

// Feature flags
const UI_FLOATING_WORDS_MAX = 3;
const UI_ENABLE_FLOATING_WORDS = true;

interface FloatingWord {
  id: number;
  text: string;
  duration: number;
  delay: number;
  drift: number;
}

export default function FloatingWords({
  words,
  startY,
  startX,
  floatDistance = 150,
  maxConcurrent = UI_FLOATING_WORDS_MAX,
  enabled = UI_ENABLE_FLOATING_WORDS,
}: FloatingWordsProps) {
  const [activeWords, setActiveWords] = useState<FloatingWord[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduce motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Spawn new floating word
  const spawnWord = useCallback(() => {
    if (!enabled || prefersReducedMotion) return;
    if (words.length === 0) return;
    if (activeWords.length >= maxConcurrent) return;

    const newWord: FloatingWord = {
      id: Date.now() + Math.random(),
      text: words[wordIndex % words.length],
      duration: 3 + Math.random() * 3, // 3-6s
      delay: 0,
      drift: 2 + Math.random() * 4, // 2-6px horizontal drift
    };

    setActiveWords(prev => [...prev, newWord]);
    setWordIndex(prev => prev + 1);
  }, [enabled, prefersReducedMotion, words, wordIndex, activeWords.length, maxConcurrent]);

  // Remove word when animation completes
  const removeWord = useCallback((id: number) => {
    setActiveWords(prev => prev.filter(w => w.id !== id));
  }, []);

  // Spawn words at intervals
  useEffect(() => {
    if (!enabled || prefersReducedMotion || words.length === 0) return;

    // Initial spawn
    spawnWord();

    // Spawn every 1.2-1.8s
    const interval = setInterval(() => {
      spawnWord();
    }, 1200 + Math.random() * 600);

    return () => clearInterval(interval);
  }, [enabled, prefersReducedMotion, words, spawnWord]);

  if (!enabled || prefersReducedMotion) return null;
  if (words.length === 0) return null;

  return (
    <div 
      className="absolute pointer-events-none z-35"
      style={{
        top: startY,
        left: startX,
      }}
    >
      <AnimatePresence mode="sync">
        {activeWords.map((word) => (
          <motion.div
            key={word.id}
            className="absolute whitespace-nowrap"
            style={{
              top: 0,
              left: 0,
            }}
            initial={{ 
              opacity: 1, 
              y: 0,
              x: 0,
              scale: 1,
            }}
            animate={{ 
              opacity: 0,
              y: -floatDistance,
              x: word.drift,
              scale: 1.02,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: word.duration,
              ease: EASING,
            }}
            onAnimationComplete={() => removeWord(word.id)}
          >
            <span
              className="text-lg md:text-xl font-serif italic"
              style={{
                color: '#FFD700',
                textShadow: `
                  0 0 12px #FFD700,
                  0 0 24px #FFD70080,
                  0 2px 8px rgba(0, 0, 0, 0.3)
                `,
                WebkitFontSmoothing: 'antialiased',
                letterSpacing: '0.02em',
              }}
            >
              {word.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

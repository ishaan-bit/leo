'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { type CSSProperties } from 'react';

type BubbleState = 'hidden' | 'text' | 'ellipsis';
type BubbleType = 'poem' | 'tip';

interface ComicBubbleProps {
  content: string;
  state: BubbleState;
  anchorPosition: { x: number; y: number }; // Position of anchor point (Leo or window)
  tailDirection: 'down' | 'up' | 'left' | 'right'; // Direction tail points
  type: BubbleType; // poem (serif) or tip (sans)
  maxWidth?: number;
  breathProgress?: number; // 0-1 for pulse sync
  className?: string;
  style?: CSSProperties;
}

const EASING = [0.65, 0, 0.35, 1] as const; // easeInOutCubic

export default function ComicBubble({
  content,
  state,
  anchorPosition,
  tailDirection = 'down',
  type,
  maxWidth = 320,
  breathProgress = 0.5,
  className = '',
  style = {},
}: ComicBubbleProps) {
  // Pulse scale synced to breath (subtle 1-2%)
  const pulseScale = 1 + (Math.sin(breathProgress * Math.PI * 2) * 0.01);
  
  // Typography based on type
  const typography = type === 'poem' ? {
    fontFamily: '"EB Garamond", "Georgia", serif',
    fontSize: state === 'ellipsis' ? '1.75rem' : '1.25rem',
    lineHeight: state === 'ellipsis' ? '1' : '1.5',
    letterSpacing: state === 'ellipsis' ? '0.2em' : '0.3px',
    maxWidth: '60ch',
  } : {
    fontFamily: '"Inter", "SF Pro Text", "Roboto", sans-serif',
    fontSize: state === 'ellipsis' ? '1.5rem' : '1rem',
    lineHeight: state === 'ellipsis' ? '1' : '1.3',
    letterSpacing: state === 'ellipsis' ? '0.2em' : 'normal',
    maxWidth: '42ch',
  };
  
  // Tail SVG paths for different directions
  const getTailPath = () => {
    switch (tailDirection) {
      case 'down':
        return 'M 20 0 L 30 20 L 40 0 Z'; // Points down
      case 'up':
        return 'M 20 20 L 30 0 L 40 20 Z'; // Points up
      case 'left':
        return 'M 20 20 L 0 30 L 20 40 Z'; // Points left
      case 'right':
        return 'M 0 20 L 20 30 L 0 40 Z'; // Points right
      default:
        return 'M 20 0 L 30 20 L 40 0 Z';
    }
  };

  const getTailPosition = () => {
    switch (tailDirection) {
      case 'down':
        return { bottom: '-18px', left: '50%', transform: 'translateX(-50%)' };
      case 'up':
        return { top: '-18px', left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { left: '-18px', top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { right: '-18px', top: '50%', transform: 'translateY(-50%)' };
    }
  };

  return (
    <AnimatePresence>
      {state !== 'hidden' && (
        <motion.div
          className={`pointer-events-none ${className}`}
          style={{
            position: 'fixed', // Fixed positioning relative to viewport
            // Position bubble relative to anchor with tail direction
            left: tailDirection === 'left' ? anchorPosition.x : anchorPosition.x,
            top: tailDirection === 'down' ? anchorPosition.y : anchorPosition.y,
            // Offset to center bubble on anchor
            transform: tailDirection === 'down' 
              ? 'translate(-50%, -100%)' // Center horizontally, place above anchor
              : tailDirection === 'left'
              ? 'translate(0, -50%)' // Place to right, center vertically
              : 'translate(-50%, -50%)',
            zIndex: 51,
            ...style, // Allow override but rarely needed now
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: 1,
            scale: pulseScale,
          }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{
            opacity: { duration: 0.8, ease: EASING },
            scale: { duration: 0.3, ease: 'easeInOut' },
          }}
        >
          {/* Bubble container */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl px-6 py-4"
            style={{
              maxWidth: `${maxWidth}px`,
              border: '2px solid rgba(0,0,0,0.1)',
            }}
          >
            {/* Tail */}
            <svg
              className="absolute"
              style={getTailPosition()}
              width="40"
              height="20"
              viewBox="0 0 40 20"
              fill="white"
            >
              <path
                d={getTailPath()}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="2"
                fill="white"
              />
            </svg>

            {/* Content with fade transitions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state === 'ellipsis' ? 'ellipsis' : 'text'}
                initial={{ opacity: 0 }}
                animate={{ opacity: state === 'ellipsis' ? 0.7 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASING }}
                className={`text-center ${type === 'poem' ? 'italic' : ''}`}
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                  letterSpacing: typography.letterSpacing,
                  maxWidth: typography.maxWidth,
                  color: '#2D2D2D',
                  minHeight: '1.5em', // Prevent layout shift
                }}
                aria-live="polite"
              >
                {state === 'ellipsis' ? '…' : content}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

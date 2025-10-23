'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { type CSSProperties } from 'react';

type BubbleState = 'hidden' | 'text' | 'ellipsis';
type BubbleType = 'poem' | 'tip';

interface ComicBubbleProps {
  content: string;
  state: BubbleState;
  anchorPosition: { x: number; y: number }; // Position of anchor point (Leo or window)
  tailDirection: 'down' | 'down-left' | 'up' | 'left' | 'right'; // Direction tail points
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
  // Pulse scale synced to breath (subtle 1-2% for poems, 1.5% for tips)
  const pulseScale = 1 + (Math.sin(breathProgress * Math.PI * 2) * (type === 'poem' ? 0.01 : 0.015));
  
  // Typography based on type
  const typography = type === 'poem' ? {
    fontFamily: '"EB Garamond", "Georgia", serif',
    fontSize: state === 'ellipsis' ? '1.75rem' : '1.3rem', // Larger for poems
    lineHeight: state === 'ellipsis' ? '1' : '1.5',
    letterSpacing: state === 'ellipsis' ? '0.2em' : '0.3px',
    maxWidth: '60ch',
  } : {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontSize: state === 'ellipsis' ? '1.5rem' : '0.875rem', // Clean sans for tips
    lineHeight: state === 'ellipsis' ? '1' : '1.45',
    letterSpacing: state === 'ellipsis' ? '0.2em' : '-0.01em', // Tighter tracking
    maxWidth: '40ch',
    fontWeight: 500, // Medium weight
  };
  
  // Visual styling based on type
  const visualStyle = type === 'poem' ? {
    background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9FB 100%)', // Warm white for poems
    border: '2px solid rgba(156, 31, 95, 0.15)', // Soft pink border
    boxShadow: '0 8px 32px rgba(156, 31, 95, 0.12), 0 2px 8px rgba(0,0,0,0.08)',
    textColor: '#2D2D2D',
  } : {
    background: 'linear-gradient(135deg, #FFF5E6 0%, #FFE8CC 100%)', // Warm amber for tips
    border: '2px solid rgba(248, 216, 181, 0.4)', // Golden border
    boxShadow: '0 6px 24px rgba(248, 216, 181, 0.3), 0 2px 6px rgba(0,0,0,0.06)',
    textColor: '#3A3A3A',
  };
  
  // Tail SVG paths for different directions
  const getTailPath = () => {
    switch (tailDirection) {
      case 'down':
        return 'M 20 0 L 30 20 L 40 0 Z'; // Points down
      case 'down-left':
        return 'M 25 0 L 5 25 L 40 5 Z'; // Points diagonally down-left (southwest)
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
      case 'down-left':
        return { bottom: '-20px', left: '60%', transform: 'translateX(-50%)' }; // Offset left for diagonal
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
            position: 'absolute', // Absolute positioning within breathing container
            // Position bubble relative to anchor
            left: anchorPosition.x,
            top: anchorPosition.y,
            // Center bubble on anchor point with tail pointing correctly
            transform: tailDirection === 'down' 
              ? 'translate(-50%, -100%)' // Center horizontally, place above anchor
              : tailDirection === 'down-left'
              ? 'translate(-55%, -100%)' // Slight offset for diagonal tail
              : tailDirection === 'up'
              ? 'translate(-50%, 0)' // Center horizontally, place below anchor
              : tailDirection === 'left'
              ? 'translate(0, -50%)' // Place to right, center vertically
              : 'translate(-100%, -50%)', // Place to left, center vertically (right tail)
            zIndex: 51,
            ...style,
          }}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{
            opacity: 1,
            scale: pulseScale,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{
            opacity: { duration: 0.8, ease: EASING },
            scale: { duration: 0.3, ease: 'easeInOut' },
            y: { duration: 0.6, ease: EASING },
          }}
        >
          {/* Subtle glow for poem bubbles */}
          {type === 'poem' && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(156, 31, 95, 0.08) 0%, transparent 70%)',
                filter: 'blur(16px)',
                zIndex: -1,
              }}
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
          

          {/* Bubble container with type-specific styling */}
          <div
            className="relative rounded-2xl px-6 py-4"
            style={{
              maxWidth: `${maxWidth}px`,
              background: visualStyle.background,
              border: visualStyle.border,
              boxShadow: visualStyle.boxShadow,
            }}
          >
            {/* Tail with matching gradient */}
            <svg
              className="absolute"
              style={getTailPosition()}
              width="40"
              height="20"
              viewBox="0 0 40 20"
            >
              <defs>
                <linearGradient id={`tailGradient-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={type === 'poem' ? '#FFFFFF' : '#FFF5E6'} />
                  <stop offset="100%" stopColor={type === 'poem' ? '#FFF9FB' : '#FFE8CC'} />
                </linearGradient>
              </defs>
              <path
                d={getTailPath()}
                stroke={type === 'poem' ? 'rgba(156, 31, 95, 0.15)' : 'rgba(248, 216, 181, 0.4)'}
                strokeWidth="2"
                fill={`url(#tailGradient-${type})`}
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
                className={`text-center ${type === 'poem' ? 'italic' : 'not-italic'}`}
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                  letterSpacing: typography.letterSpacing,
                  maxWidth: typography.maxWidth,
                  color: visualStyle.textColor,
                  minHeight: '1.5em', // Prevent layout shift
                  fontWeight: type === 'poem' ? 400 : (typography as any).fontWeight || 500,
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

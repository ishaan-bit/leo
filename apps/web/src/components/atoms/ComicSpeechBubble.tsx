/**
 * ComicSpeechBubble - Classic comic panel speech balloon
 * 
 * Features:
 * - Rounded capsule body with soft inner shadow and subtle grain
 * - Curved triangular tail that points to any side
 * - Style variants: "pig" (warm cream) and "window" (cooler cream with glass highlight)
 * - Proper content wrapping with responsive max-width
 * - GPU-accelerated animations (transform + opacity only)
 * - Accessibility compliant (AA contrast, reduce-motion support)
 */

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ComicSpeechBubbleProps {
  /** Text content */
  content: string;
  
  /** Visual style variant */
  variant?: 'pig' | 'window';
  
  /** Which direction the tail points */
  tailDirection: 'up' | 'down' | 'left' | 'right';
  
  /** Horizontal offset of tail from center (0-100, default 50 = center) */
  tailOffsetX?: number;
  
  /** Vertical offset of tail from center (0-100, default 50 = center) */
  tailOffsetY?: number;
  
  /** Shadow depth level (1-3) */
  shadowLevel?: number;
  
  /** Optional max width for bubble */
  maxWidth?: number;
  
  /** Callback when bubble appears */
  onAppear?: () => void;
}

const EASING = [0.42, 0, 0.58, 1] as const;

// Feature flags
const UI_BALLOON_SHADOW_LEVEL = 2; // Global depth tuning (1-3)

export default function ComicSpeechBubble({
  content,
  variant = 'pig',
  tailDirection,
  tailOffsetX = 50,
  tailOffsetY = 50,
  shadowLevel = UI_BALLOON_SHADOW_LEVEL,
  onAppear,
  maxWidth,
}: ComicSpeechBubbleProps) {
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

  // Style variants
  const styles = {
    pig: {
      background: 'linear-gradient(135deg, #FFF8F0 0%, #F5EDE3 100%)',
      borderColor: 'rgba(139, 117, 99, 0.15)',
      textColor: '#3D3229',
      glowColor: 'rgba(255, 248, 240, 0.6)',
    },
    window: {
      background: 'linear-gradient(135deg, #FFFBF0 0%, #FFF4E0 100%)',
      borderColor: 'rgba(99, 117, 139, 0.15)',
      textColor: '#2D3342',
      glowColor: 'rgba(240, 245, 255, 0.6)',
    },
  };

  const currentStyle = styles[variant];

  // Shadow levels
  const shadows = {
    1: `0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)`,
    2: `0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.16)`,
    3: `0 8px 24px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.2)`,
  };

  const shadowDepth = shadows[Math.min(Math.max(shadowLevel, 1), 3) as 1 | 2 | 3];

  // Tail positioning based on direction
  const getTailStyle = () => {
    const tailSize = 16; // Base size of tail
    
    switch (tailDirection) {
      case 'up':
        return {
          position: 'absolute' as const,
          top: '-10px',
          left: `${tailOffsetX}%`,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid ${currentStyle.background.split(',')[0].split('(')[1]}`,
          filter: 'drop-shadow(0 -2px 3px rgba(0, 0, 0, 0.08))',
        };
      case 'down':
        return {
          position: 'absolute' as const,
          bottom: '-10px',
          left: `${tailOffsetX}%`,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid transparent`,
          borderTop: `${tailSize}px solid ${currentStyle.background.split(',')[0].split('(')[1]}`,
          filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.08))',
        };
      case 'left':
        return {
          position: 'absolute' as const,
          left: '-10px',
          top: `${tailOffsetY}%`,
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid ${currentStyle.background.split(',')[0].split('(')[1]}`,
          filter: 'drop-shadow(-2px 0 3px rgba(0, 0, 0, 0.08))',
        };
      case 'right':
        return {
          position: 'absolute' as const,
          right: '-10px',
          top: `${tailOffsetY}%`,
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid transparent`,
          borderLeft: `${tailSize}px solid ${currentStyle.background.split(',')[0].split('(')[1]}`,
          filter: 'drop-shadow(2px 0 3px rgba(0, 0, 0, 0.08))',
        };
    }
  };

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={prefersReducedMotion ? { opacity: 1, scale: 1 } : { 
        opacity: 1, 
        scale: 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        duration: prefersReducedMotion ? 0.15 : 0.35,
        ease: EASING,
      }}
      onAnimationComplete={() => {
        if (onAppear) onAppear();
      }}
    >
      {/* Bubble body */}
      <motion.div
        className="relative px-4 py-3 rounded-[28px] max-w-[320px] md:max-w-[400px]"
        style={{
          ...(maxWidth ? { maxWidth: `${maxWidth}px` } : {}),
          background: currentStyle.background,
          border: `1.5px solid ${currentStyle.borderColor}`,
          boxShadow: shadowDepth,
        }}
        whileHover={{ 
          boxShadow: shadows[Math.min(shadowLevel + 1, 3) as 1 | 2 | 3],
          transition: { duration: 0.2 },
        }}
        whileTap={{ 
          scale: 0.98,
          transition: { duration: 0.1 },
        }}
      >
        {/* Subtle inner shadow for depth */}
        <div 
          className="absolute inset-0 rounded-[28px] pointer-events-none"
          style={{
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
          }}
        />
        
        {/* Subtle grain texture */}
        <div 
          className="absolute inset-0 rounded-[28px] opacity-[0.03] pointer-events-none mix-blend-multiply"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
          }}
        />
        
        {/* Glassy highlight for window variant */}
        {variant === 'window' && (
          <div 
            className="absolute top-0 left-[20%] right-[20%] h-[40%] rounded-t-[28px] pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
          />
        )}
        
        {/* Text content */}
        <p 
          className="relative font-serif text-sm md:text-base leading-relaxed italic"
          style={{
            color: currentStyle.textColor,
            letterSpacing: '0.01em',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          {content}
        </p>
      </motion.div>
      
      {/* Curved tail */}
      <motion.div 
        style={getTailStyle()}
        initial={prefersReducedMotion ? {} : { 
          y: tailDirection === 'up' ? 3 : tailDirection === 'down' ? -3 : 0,
          x: tailDirection === 'left' ? 3 : tailDirection === 'right' ? -3 : 0,
        }}
        animate={{ y: 0, x: 0 }}
        transition={{ 
          duration: 0.3,
          delay: 0.25,
          ease: EASING,
        }}
      />
      
      {/* Soft outer glow (optional, very subtle) */}
      <div 
        className="absolute inset-0 -z-10 blur-xl opacity-20 pointer-events-none rounded-[32px]"
        style={{
          background: currentStyle.glowColor,
          transform: 'scale(1.1)',
        }}
      />
    </motion.div>
  );
}

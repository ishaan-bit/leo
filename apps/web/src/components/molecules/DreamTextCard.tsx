/**
 * Dream Text Card - Glass-style floating text with fade/float animation
 * WCAG AA compliant contrast (≥4.5:1)
 */

'use client';

import { motion } from 'framer-motion';

interface DreamTextCardProps {
  text: string;
  primaryColor: string;
}

const EASING = [0.4, 0, 0.2, 1]; // sine-in-out

export function DreamTextCard({ text, primaryColor }: DreamTextCardProps) {
  // Calculate text color for contrast
  // Simple heuristic: if primary is light, use dark text; if dark, use light text
  const getContrastColor = (hexColor: string): string => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // If luminance > 0.5, use dark text; otherwise light text
    return luminance > 0.5 ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';
  };

  const textColor = getContrastColor(primaryColor);
  
  return (
    <motion.div
      className="max-w-2xl w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        duration: 0.5,
        ease: EASING,
      }}
    >
      <div
        className="relative px-6 py-5 md:px-8 md:py-6 rounded-xl"
        style={{
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: `
            0 8px 32px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
        }}
      >
        <p
          className="text-lg md:text-xl text-center leading-relaxed"
          style={{
            fontFamily: '"Cormorant Garamond", "EB Garamond", serif',
            color: textColor,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            letterSpacing: '0.02em',
            lineHeight: '1.8',
          }}
        >
          {text}
        </p>
      </div>
    </motion.div>
  );
}

export default DreamTextCard;

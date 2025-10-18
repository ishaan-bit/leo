'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface FuryProps {
  size?: number;
  mood?: 'calm' | 'curious' | 'happy';
  className?: string;
}

/**
 * Fury - Floating pig avatar with subtle animations
 * Appears in scenes as a guide/companion
 */
export default function Fury({ size = 120, mood = 'calm', className = '' }: FuryProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      animate={{
        y: [0, -8, 0],
        rotate: isHovered ? [0, 2, -2, 0] : 0,
      }}
      transition={{
        y: {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        rotate: {
          duration: 0.5,
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow aura */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,207,232,0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Pig SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wings */}
        <motion.ellipse
          cx="70"
          cy="100"
          rx="30"
          ry="15"
          fill="#FFC8DD"
          opacity="0.6"
          animate={{
            scaleY: mood === 'happy' ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.6,
            repeat: mood === 'happy' ? Infinity : 0,
          }}
        />
        <motion.ellipse
          cx="130"
          cy="100"
          rx="30"
          ry="15"
          fill="#FFC8DD"
          opacity="0.6"
          animate={{
            scaleY: mood === 'happy' ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.6,
            repeat: mood === 'happy' ? Infinity : 0,
            delay: 0.15,
          }}
        />

        {/* Body */}
        <circle cx="100" cy="100" r="50" fill="#FFB3C6" />

        {/* Ears */}
        <ellipse cx="75" cy="70" rx="12" ry="20" fill="#FFB3C6" />
        <ellipse cx="125" cy="70" rx="12" ry="20" fill="#FFB3C6" />

        {/* Eyes */}
        <motion.circle
          cx="85"
          cy="95"
          r={mood === 'curious' ? 6 : 5}
          fill="#2D3748"
          animate={{
            scaleY: mood === 'calm' ? [1, 0.1, 1] : 1,
          }}
          transition={{
            duration: 3,
            repeat: mood === 'calm' ? Infinity : 0,
            repeatDelay: 2,
          }}
        />
        <motion.circle
          cx="115"
          cy="95"
          r={mood === 'curious' ? 6 : 5}
          fill="#2D3748"
          animate={{
            scaleY: mood === 'calm' ? [1, 0.1, 1] : 1,
          }}
          transition={{
            duration: 3,
            repeat: mood === 'calm' ? Infinity : 0,
            repeatDelay: 2,
          }}
        />

        {/* Snout */}
        <ellipse cx="100" cy="110" rx="18" ry="14" fill="#FF9AB5" />
        <circle cx="95" cy="108" r="3" fill="#2D3748" />
        <circle cx="105" cy="108" r="3" fill="#2D3748" />

        {/* Smile */}
        {mood === 'happy' && (
          <path
            d="M 90 118 Q 100 123 110 118"
            stroke="#2D3748"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    </motion.div>
  );
}

/**
 * pig-animations.ts
 * Animation utilities for the pink pig character
 */

import { Variants } from 'framer-motion';

/**
 * Breathing animation - gentle up/down movement
 */
export const breathingAnimation: Variants = {
  breathing: {
    y: [0, -8, 0],
    scale: [1, 1.02, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Blinking animation - periodic eye blink
 */
export const blinkingAnimation = {
  blink: {
    scaleY: [1, 0.1, 1],
    transition: {
      duration: 0.15,
      times: [0, 0.5, 1],
    },
  },
};

/**
 * Cursor follow animation - eyes track mouse
 */
export function calculateEyePosition(
  mouseX: number,
  mouseY: number,
  pigCenterX: number,
  pigCenterY: number,
  maxDistance: number = 10
) {
  const deltaX = mouseX - pigCenterX;
  const deltaY = mouseY - pigCenterY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  if (distance === 0) return { x: 0, y: 0 };
  
  const normalizedX = deltaX / distance;
  const normalizedY = deltaY / distance;
  
  const clampedDistance = Math.min(distance / 50, maxDistance);
  
  return {
    x: normalizedX * clampedDistance,
    y: normalizedY * clampedDistance,
  };
}

/**
 * Exhale animation - pig breathes out with heart puff
 */
export const exhaleAnimation: Variants = {
  initial: {
    scale: 1,
    y: 0,
  },
  exhale: {
    scale: [1, 1.05, 0.98, 1],
    y: [0, -5, 2, 0],
    transition: {
      duration: 1.5,
      times: [0, 0.3, 0.7, 1],
      ease: 'easeInOut',
    },
  },
};

/**
 * Heart puff particles on exhale
 */
export function generateHeartPuff(count: number = 5) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count;
    const distance = 60 + Math.random() * 40;
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30, // Float upward
      rotation: Math.random() * 360,
      delay: i * 0.1,
    };
  });
}

/**
 * Ear flutter animation - during voice input
 */
export const earFlutterAnimation: Variants = {
  flutter: {
    rotate: [0, 10, -10, 5, -5, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Curious head tilt
 */
export const headTiltAnimation: Variants = {
  tilt: {
    rotate: [0, 3, -2, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Happy bounce
 */
export const happyBounce: Variants = {
  bounce: {
    y: [0, -15, -5, -10, 0],
    transition: {
      duration: 0.6,
      times: [0, 0.3, 0.5, 0.7, 1],
      ease: 'easeOut',
    },
  },
};

/**
 * Get animation based on pig mood
 */
export function getPigAnimation(mood: 'calm' | 'curious' | 'happy' | 'listening') {
  switch (mood) {
    case 'calm':
      return 'breathing';
    case 'curious':
      return 'tilt';
    case 'happy':
      return 'bounce';
    case 'listening':
      return 'flutter';
    default:
      return 'breathing';
  }
}

'use client';

/**
 * AmbientElements - Emotion-specific environmental overlays
 * Each emotion gets a subtle, slow-moving SVG or particle layer
 * that fades in/out with the pulse cycle.
 */

import { motion } from 'framer-motion';
import type { EmotionKey } from '@/content/regions';

interface AmbientProps {
  opacity: number;
  pulseStrength: number;
}

// Joy → floating pollen
export function PollenDrift({ opacity, pulseStrength }: AmbientProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <radialGradient id="pollen-glow">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[...Array(12)].map((_, i) => (
        <motion.circle
          key={i}
          cx={`${10 + (i * 7)}%`}
          cy={`${20 + (i * 6)}%`}
          r="2"
          fill="url(#pollen-glow)"
          animate={{
            cy: [`${20 + (i * 6)}%`, `${15 + (i * 6)}%`, `${20 + (i * 6)}%`],
            opacity: [0.3, 0.6 * pulseStrength, 0.3],
          }}
          transition={{
            duration: 8 + (i * 0.5),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}
    </svg>
  );
}

// Sadness → mist layer
export function MistRise({ opacity, pulseStrength }: AmbientProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(226, 232, 240, 0.3), transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          y: ['20%', '-20%', '20%'],
          opacity: [0.2, 0.4 * pulseStrength, 0.2],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// Anger → embers
export function EmberSparks({ opacity, pulseStrength }: AmbientProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <radialGradient id="ember-glow">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[...Array(8)].map((_, i) => (
        <motion.circle
          key={i}
          cx={`${15 + (i * 10)}%`}
          cy="90%"
          r="1.5"
          fill="url(#ember-glow)"
          animate={{
            cy: ['90%', `${30 - (i * 2)}%`],
            opacity: [0.8 * pulseStrength, 0],
            r: [1.5, 0.5],
          }}
          transition={{
            duration: 4 + (i * 0.3),
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 0.5,
          }}
        />
      ))}
    </svg>
  );
}

// Fear → leaves or pine needles
export function LeafFall({ opacity, pulseStrength }: AmbientProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <linearGradient id="leaf-color" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#86efac" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {[...Array(10)].map((_, i) => (
        <motion.ellipse
          key={i}
          cx={`${20 + (i * 8)}%`}
          cy="0%"
          rx="3"
          ry="6"
          fill="url(#leaf-color)"
          animate={{
            cy: ['0%', '100%'],
            cx: [`${20 + (i * 8)}%`, `${25 + (i * 8)}%`, `${20 + (i * 8)}%`],
            rotate: [0, 180, 360],
            opacity: [0, 0.5 * pulseStrength, 0],
          }}
          transition={{
            duration: 12 + (i * 0.8),
            repeat: Infinity,
            ease: 'linear',
            delay: i * 1.2,
          }}
        />
      ))}
    </svg>
  );
}

// Disgust → dust motes
export function DustSwirl({ opacity, pulseStrength }: AmbientProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <radialGradient id="dust-particle">
          <stop offset="0%" stopColor="#d6d3d1" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#78716c" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[...Array(15)].map((_, i) => (
        <motion.circle
          key={i}
          cx={`${10 + (i * 6)}%`}
          cy={`${30 + (i * 4)}%`}
          r="1"
          fill="url(#dust-particle)"
          animate={{
            cx: [
              `${10 + (i * 6)}%`,
              `${15 + (i * 6)}%`,
              `${10 + (i * 6)}%`,
            ],
            cy: [
              `${30 + (i * 4)}%`,
              `${25 + (i * 4)}%`,
              `${30 + (i * 4)}%`,
            ],
            opacity: [0.2, 0.4 * pulseStrength, 0.2],
          }}
          transition={{
            duration: 10 + (i * 0.4),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.6,
          }}
        />
      ))}
    </svg>
  );
}

// Surprise → light refractions
export function LightRefraction({ opacity, pulseStrength }: AmbientProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: `${10 + (i * 18)}%`,
            left: `${5 + (i * 15)}%`,
            width: '100px',
            height: '2px',
            background: `linear-gradient(90deg, 
              transparent, 
              rgba(251, 207, 232, ${0.6 * pulseStrength}), 
              transparent)`,
            filter: 'blur(2px)',
          }}
          animate={{
            x: ['-100px', '100vw'],
            opacity: [0, 0.8 * pulseStrength, 0],
          }}
          transition={{
            duration: 6 + (i * 0.5),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 1.2,
          }}
        />
      ))}
    </div>
  );
}

// Trust → candle smoke
export function CandleSmoke({ opacity, pulseStrength }: AmbientProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0"
          style={{
            left: `${20 + (i * 20)}%`,
            width: '40px',
            height: '120px',
            background: `linear-gradient(to top, 
              rgba(250, 245, 255, ${0.3 * pulseStrength}), 
              transparent)`,
            filter: 'blur(20px)',
          }}
          animate={{
            y: ['0%', '-200%'],
            x: [0, 20, -10, 15, 0],
            opacity: [0.4 * pulseStrength, 0],
            scale: [0.8, 1.2],
          }}
          transition={{
            duration: 15 + (i * 2),
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 3,
          }}
        />
      ))}
    </div>
  );
}

// Anticipation → wind streaks
export function WindStreaks({ opacity, pulseStrength }: AmbientProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: `${15 + (i * 12)}%`,
            left: '-10%',
            width: '150px',
            height: '1px',
            background: `linear-gradient(90deg, 
              transparent, 
              rgba(165, 180, 252, ${0.5 * pulseStrength}), 
              transparent)`,
            filter: 'blur(1px)',
          }}
          animate={{
            x: ['-150px', 'calc(100vw + 150px)'],
            opacity: [0, 0.7 * pulseStrength, 0],
          }}
          transition={{
            duration: 5 + (i * 0.3),
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.8,
          }}
        />
      ))}
    </div>
  );
}

// Mapping emotion to ambient element
export const AMBIENT_ELEMENTS: Record<
  EmotionKey,
  (props: AmbientProps) => JSX.Element
> = {
  joy: PollenDrift,
  sadness: MistRise,
  anger: EmberSparks,
  fear: LeafFall,
  disgust: DustSwirl,
  surprise: LightRefraction,
  trust: CandleSmoke,
  anticipation: WindStreaks,
};

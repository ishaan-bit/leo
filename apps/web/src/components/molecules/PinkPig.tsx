/**
 * PinkPig.tsx
 * Now uses the actual Leo SVG from /public/images/leo.svg with built-in CSS animations
 * for wings, blink, breath, and flutter. Adds rapid flap on happy state.
 */
'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface PinkPigProps {
  state?: 'idle' | 'speaking' | 'happy' | 'thinking';
  size?: number;
  className?: string;
  onInputFocus?: boolean;
  wordCount?: number; // For dynamic blush intensity
}

export default function PinkPig({ 
  state = 'idle',
  size = 240,
  className = '',
  onInputFocus = false,
  wordCount = 0
}: PinkPigProps) {
  // Add rapid flutter when happy
  const [shouldFlutter, setShouldFlutter] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  
  // Calculate blush intensity based on word count (0 words = 0.25 opacity, 100+ words = 0.7 opacity)
  const blushIntensity = Math.min(0.7, 0.25 + (wordCount / 100) * 0.45);
  
  useEffect(() => {
    if (state === 'happy') {
      setShouldFlutter(true);
      setShowSparkles(true);
      const flutterTimer = setTimeout(() => setShouldFlutter(false), 2000);
      const sparkleTimer = setTimeout(() => setShowSparkles(false), 1500);
      return () => {
        clearTimeout(flutterTimer);
        clearTimeout(sparkleTimer);
      };
    }
  }, [state]);

  // Cinematic animation variants - idle now includes scale pulsing for breathing
  const pigVariants = {
    idle: { 
      y: [-8, 8, -8],
      rotate: [-2, 2, -2],
      scale: [1, 1.03, 1], // Add subtle scale pulsing for breathing effect
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    thinking: {
      y: [-8, 8, -8],
      rotate: [-2, 2, -2],
      scale: [1, 1.03, 1], // Same breathing animation during thinking
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    happy: { 
      y: [-10, 0],
      scale: [1, 1.05, 1],
      transition: { 
        duration: 0.5,
        ease: [0.34, 1.56, 0.64, 1] // easeOutBack
      }
    }
  };

  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      variants={pigVariants}
      animate={state === 'happy' ? 'happy' : (state === 'thinking' ? 'thinking' : 'idle')}
    >
      {/* Soft reflection glow underneath */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-gradient-to-t from-pink-200/40 to-transparent rounded-full blur-2xl"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [0.9, 1, 0.9]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Glow pulse when happy */}
      {state === 'happy' && (
        <motion.div
          className="absolute inset-0 bg-gradient-radial from-pink-300/60 via-rose-300/40 to-transparent rounded-full blur-3xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [0.8, 1.3, 1.3],
            opacity: [0, 0.8, 0]
          }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      )}

      {/* Sparkle burst on happy */}
      {showSparkles && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => {
            const angle = (Math.PI * 2 * i) / 12;
            const distance = 60 + Math.random() * 20;
            return (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute w-2 h-2 bg-yellow-200 rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  boxShadow: '0 0 8px rgba(253, 224, 71, 0.8)'
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: [0, 1.2, 0.4]
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.34, 1.56, 0.64, 1]
                }}
              />
            );
          })}
        </div>
      )}

      {/* Typing reaction - soft cheek glow that increases with word count */}
      {onInputFocus && state !== 'happy' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: blushIntensity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute left-[20%] top-[52%] w-8 h-8 bg-pink-400 rounded-full blur-xl" />
          <div className="absolute right-[20%] top-[52%] w-8 h-8 bg-pink-400 rounded-full blur-xl" />
        </motion.div>
      )}

      {/* Leo SVG - embedded with all built-in CSS animations */}
      <div
        className="relative z-10"
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{
          __html: `
            <svg viewBox="0 0 128 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%;">
              <title>Leo the winged pig</title>
              <defs>
                <linearGradient id="glow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stop-color="#fff" stop-opacity=".55"></stop>
                  <stop offset=".35" stop-color="#fff" stop-opacity=".18"></stop>
                  <stop offset="1" stop-color="#fff" stop-opacity="0"></stop>
                </linearGradient>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-opacity=".18"></feDropShadow>
                </filter>
                <style>
                  .leo-wrap{transform-box:fill-box;transform-origin:50% 50%}
                  .eye{transform-box:fill-box;transform-origin:center}
                  .ear-rot,.wing-rot{transform-box:fill-box;transform-origin:center}
                  
                  @keyframes breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}}
                  .breath-on{animation:breath 3.2s ease-in-out infinite}
                  
                  @keyframes flap{0%,100%{transform:rotate(0)}50%{transform:rotate(7deg)}}
                  @keyframes rapid-flap{0%,100%{transform:rotate(0)}50%{transform:rotate(15deg)}}
                  .flap-on .wing-rot{animation:${shouldFlutter ? 'rapid-flap 0.25s' : 'flap 2.6s'} ease-in-out infinite}
                  
                  @keyframes flutter{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}
                  .flutter-on .ear-rot{animation:flutter 4.2s ease-in-out infinite}
                  
                  @keyframes blink{0%,6%,100%{transform:scaleY(1)}3%{transform:scaleY(0.12)}}
                  .blink-on .eye{animation:blink 7.5s linear infinite}
                  
                  @media (prefers-reduced-motion:reduce){
                    .breath-on,.flap-on .wing-rot,.flutter-on .ear-rot,.blink-on .eye{animation:none!important}
                  }
                </style>
              </defs>
              
              <g class="leo-wrap breath-on blink-on flap-on flutter-on" pointer-events="none">
                <g class="wing wing-l" transform="translate(22 40)" filter="url(#shadow)">
                  <g class="wing-rot" transform-origin="16 10">
                    <path d="M16 12c-8 0-16-4-16-12 7 2.8 12-2 16.8-2C22.5-2 27 2.5 27 7s-6 5-11 5z" fill="#FFF4F7" stroke="#E7CED7" stroke-width="1"></path>
                    <path d="M6 7c2 1.5 4.2 2.6 6.2 2.9" fill="none" stroke="#E7CED7" stroke-width="1" stroke-linecap="round"></path>
                  </g>
                </g>
                
                <g class="wing wing-r" transform="translate(106 40) scale(-1 1)" filter="url(#shadow)">
                  <g class="wing-rot" transform-origin="16 10">
                    <path d="M16 12c-8 0-16-4-16-12 7 2.8 12-2 16.8-2C22.5-2 27 2.5 27 7s-6 5-11 5z" fill="#FFF4F7" stroke="#E7CED7" stroke-width="1"></path>
                    <path d="M6 7c2 1.5 4.2 2.6 6.2 2.9" fill="none" stroke="#E7CED7" stroke-width="1" stroke-linecap="round"></path>
                  </g>
                </g>
                
                <ellipse cx="64" cy="56" rx="32" ry="27" fill="#F6B3C1"></ellipse>
                <ellipse cx="64" cy="46" rx="27" ry="14" fill="url(#glow)"></ellipse>
                
                <g class="ear ear-l"><g class="ear-rot">
                  <path d="M38 27c4.8-8.2 13-8.4 16.6-3.4-5.2 3.7-10 5.2-16.6 3.4z" fill="#F6B3C1"></path>
                </g></g>
                <g class="ear ear-r"><g class="ear-rot">
                  <path d="M90 27c-4.8-8.2-13-8.4-16.6-3.4 5.2 3.7 10 5.2 16.6 3.4z" fill="#F6B3C1"></path>
                </g></g>
                
                <rect x="57" y="32" width="14" height="2.4" rx="1.2" fill="#CC8795" opacity=".55"></rect>
                
                <circle class="eye eye-l" cx="50.5" cy="44" r="2.6" fill="#35242B"></circle>
                <circle class="eye eye-r" cx="77.5" cy="44" r="2.6" fill="#35242B"></circle>
                
                <ellipse cx="44" cy="50.5" rx="6" ry="3.6" fill="#F29EB0" opacity=".45"></ellipse>
                <ellipse cx="84" cy="50.5" rx="6" ry="3.6" fill="#F29EB0" opacity=".45"></ellipse>
                
                <ellipse cx="64" cy="60" rx="11.6" ry="8.2" fill="#F1A3B1"></ellipse>
                <circle cx="58.7" cy="60" r="1.6" fill="#4B2E3D"></circle>
                <circle cx="69.3" cy="60" r="1.6" fill="#4B2E3D"></circle>
                <path d="M52 66c4.6 3.6 19.4 3.6 24 0" fill="none" stroke="#4B2E3D" stroke-width="1.6" stroke-linecap="round"></path>
              </g>
            </svg>
          `,
        }}
      />
    </motion.div>
  );
}

/**
 * Dream Controls - Skip button and playback controls
 * Accessible with keyboard and focus rings
 */

'use client';

import { motion } from 'framer-motion';

interface DreamControlsProps {
  onSkip: () => void;
  onPause: () => void;
  isPaused: boolean;
  currentTime: number;
  duration: number;
}

export function DreamControls({
  onSkip,
  onPause,
  isPaused,
  currentTime,
  duration,
}: DreamControlsProps) {
  const progress = (currentTime / duration) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-6 pointer-events-none">
      <div className="max-w-4xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Skip button */}
        <motion.button
          onClick={onSkip}
          className="px-5 py-2.5 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent"
          style={{
            fontFamily: '"Inter", sans-serif',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: 'rgba(0, 0, 0, 0.85)',
          }}
          whileHover={{
            scale: 1.05,
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
          }}
          whileTap={{ scale: 0.95 }}
          aria-label="Skip dream and continue to reflect"
        >
          Skip
        </motion.button>

        {/* Progress bar */}
        <div className="flex-1 mx-6 h-1 rounded-full bg-white/20 overflow-hidden">
          <motion.div
            className="h-full bg-white/60"
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>

        {/* Pause/Play button */}
        <motion.button
          onClick={onPause}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
          whileHover={{
            scale: 1.05,
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
          }}
          whileTap={{ scale: 0.95 }}
          aria-label={isPaused ? 'Resume dream' : 'Pause dream'}
        >
          {isPaused ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L12 7L0 14V0Z" fill="rgba(0,0,0,0.7)" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="4" height="14" fill="rgba(0,0,0,0.7)" />
              <rect x="8" width="4" height="14" fill="rgba(0,0,0,0.7)" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Keyboard hints (accessible) */}
      <div className="sr-only">
        Press Escape to skip, Space to pause or resume
      </div>
    </div>
  );
}

export default DreamControls;

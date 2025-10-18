'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initAmbientSound, playAmbientSound, stopAmbientSound } from '../../lib/sound';

type Props = {
  autoHintDelayMs?: number; // when to fade in the hint
  autoHideDelayMs?: number; // when to auto-hide the hint after showing
};

export default function SoundToggle({ autoHintDelayMs = 2000, autoHideDelayMs = 3000 }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Pre-instantiate Howler object so it's ready after the first tap.
    try {
      const sound = initAmbientSound();
      setInitialized(true);
      
      // Check if sound is already playing and sync state
      if (sound && sound.playing()) {
        setEnabled(true);
      }
      
      // Periodically sync state with actual playback (in case something else controls it)
      const syncInterval = setInterval(() => {
        if (sound) {
          const isPlaying = sound.playing();
          setEnabled(isPlaying);
        }
      }, 1000);
      
      return () => clearInterval(syncInterval);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    // Show hint after delay
    const showTimer = setTimeout(() => setShowHint(true), autoHintDelayMs);
    
    // Auto-hide hint after additional delay
    const hideTimer = setTimeout(() => setShowHint(false), autoHintDelayMs + autoHideDelayMs);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [autoHintDelayMs, autoHideDelayMs]);

  function toggle() {
    setHasInteracted(true);
    setShowHint(false); // Hide hint on interaction
    
    if (!enabled) {
      playAmbientSound();
      setEnabled(true);
    } else {
      stopAmbientSound();
      setEnabled(false);
    }
  }

  return (
    <motion.div
      className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-1 pointer-events-none"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!initialized}
        className={`relative rounded-full text-sm shadow-md border pointer-events-auto
          border-white/40 backdrop-blur-md hover:bg-white/60 hover:scale-110
          focus:outline-none focus:ring-2 focus:ring-pink-300/60 
          transition-all duration-300 ${initialized ? '' : 'opacity-60 cursor-not-allowed'}`}
        style={{ 
          minWidth: '32px', 
          minHeight: '32px', 
          padding: '6px',
          background: enabled ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.35)'
        }}
        aria-pressed={enabled}
        aria-label={enabled ? 'Turn ambient sound off' : 'Turn ambient sound on'}
      >
        {/* Halo pulse when enabled - smaller */}
        {enabled && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-pink-300/30 -z-10"
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5] 
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-pink-400/20"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}
        
        <span className="relative z-10">
          {enabled ? '🔊' : '🔈'}
        </span>
      </button>

      {/* Tooltip hint that auto-shows once then hides */}
      <AnimatePresence>
        {showHint && !hasInteracted && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.4 }}
            className="text-[10px] text-pink-900/70 bg-white/60 backdrop-blur-sm pointer-events-none
              px-2 py-1 rounded-full shadow-sm border border-white/30"
            role="tooltip"
          >
            ambient music
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

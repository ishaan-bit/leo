'use client';

import { motion } from 'framer-motion';
import { initAmbientSound, playAmbientSound, stopAmbientSound, isMuted } from '@/lib/sound';
import { useState, useEffect } from 'react';

type Props = {
  leftElement?: React.ReactNode;
  centerElement?: React.ReactNode;
  showSoundToggle?: boolean;
};

export default function TopNav({ leftElement, centerElement, showSoundToggle = true }: Props) {
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    setSoundEnabled(!isMuted());
  }, []);

  const toggleSound = () => {
    const sound = initAmbientSound();
    const currentlyMuted = isMuted();
    if (currentlyMuted) {
      playAmbientSound();
      setSoundEnabled(true);
    } else {
      stopAmbientSound();
      setSoundEnabled(false);
    }
  };

  return (
    <div 
      className="fixed left-0 right-0 z-[60] pointer-events-none flex items-center justify-between"
      style={{
        top: 'max(1rem, env(safe-area-inset-top))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
      }}
    >
      {/* Left element */}
      <div className="pointer-events-auto flex items-center">
        {leftElement || <div className="w-8 h-8"></div>}
      </div>
      
      {/* Center element - absolutely centered to avoid flex shifting */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto flex items-center justify-center">
        {centerElement}
      </div>
      
      {/* Right: Sound toggle */}
      <div className="pointer-events-auto flex items-center">
        {showSoundToggle && (
          <motion.button
            type="button"
            onClick={toggleSound}
            className="rounded-full text-sm shadow-md border border-white/40 backdrop-blur-md hover:bg-white/60 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-pink-300/60 transition-all duration-300"
            style={{ 
              minWidth: '32px', 
              minHeight: '32px', 
              padding: '6px',
              background: soundEnabled ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.35)'
            }}
            aria-label={soundEnabled ? 'Turn ambient sound off' : 'Turn ambient sound on'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <span>{soundEnabled ? '🔊' : '🔈'}</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}

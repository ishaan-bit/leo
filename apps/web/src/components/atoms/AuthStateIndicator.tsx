'use client';

import { motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

interface AuthStateIndicatorProps {
  userName?: string | null;
  isGuest: boolean;
}

export default function AuthStateIndicator({ userName, isGuest }: AuthStateIndicatorProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    
    // Fade out animation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Sign out
    await signOut({ callbackUrl: '/' });
  };

  return (
    <>
      {/* Auth status indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="fixed top-6 right-6 z-30 flex items-center gap-3"
      >
        {/* Status text */}
        <motion.div
          className="text-sm text-pink-700/70 font-serif italic"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {isGuest ? (
            <span>Guest mode 🌸</span>
          ) : (
            <span>Signed in as {userName} 🪶</span>
          )}
        </motion.div>

        {/* Sign out button - feather icon */}
        {!isGuest && (
          <motion.button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="relative w-8 h-8 flex items-center justify-center rounded-full bg-pink-100/60 hover:bg-pink-200/80 transition-all duration-300 disabled:opacity-50"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            title="Sign out"
          >
            {/* Feather icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-pink-600"
            >
              <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
              <line x1="16" y1="8" x2="2" y2="22" />
              <line x1="17.5" y1="15" x2="9" y2="15" />
            </svg>
          </motion.button>
        )}
      </motion.div>

      {/* Sign-out overlay animation */}
      {isSigningOut && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-pink-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="text-center space-y-4"
          >
            {/* Floating feather animation */}
            <motion.div
              animate={{
                y: [0, -20, 0],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-6xl"
            >
              🪶
            </motion.div>
            <p className="text-pink-800 text-lg font-serif italic">
              Until we meet again...
            </p>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

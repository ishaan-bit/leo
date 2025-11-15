'use client';

import { motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

interface AuthStateIndicatorProps {
  userName?: string | null;
  isGuest: boolean;
  pigName?: string; // For personalized farewell message
}

export default function AuthStateIndicator({ userName, isGuest, pigName = 'Leo' }: AuthStateIndicatorProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    
    // Fade out animation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Sign out and redirect to start page
    await signOut({ callbackUrl: '/start' });
  };

  return (
    <>
      {/* Auth status indicator - centered at top with poetic styling */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex items-center gap-2.5 bg-white/40 backdrop-blur-md rounded-full px-5 py-2.5 shadow-lg border border-white/50"
      >
        {/* Status text with shimmer */}
        <motion.div
          className="text-xs font-serif italic text-pink-900/80 whitespace-nowrap"
          style={{ 
            fontFamily: "'DM Serif Text', serif",
            letterSpacing: '0.01em'
          }}
          animate={{
            opacity: [0.75, 0.95, 0.75],
          }}
          transition={{
            duration: 4,
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

        {/* Sign out button - feather icon with gentle float */}
        {!isGuest && (
          <motion.button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="relative w-7 h-7 flex items-center justify-center rounded-full bg-pink-100/50 hover:bg-pink-200/70 transition-all duration-300 disabled:opacity-50 group"
            whileHover={{ scale: 1.15, rotate: 8 }}
            whileTap={{ scale: 0.9 }}
            title="Sign out"
          >
            {/* Feather icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 text-pink-700 group-hover:text-pink-800 transition-colors"
            >
              <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
              <line x1="16" y1="8" x2="2" y2="22" />
              <line x1="17.5" y1="15" x2="9" y2="15" />
            </svg>
            
            {/* Hover glow */}
            <motion.div
              className="absolute inset-0 rounded-full bg-pink-300/30 -z-10"
              initial={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.5, opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        )}
      </motion.div>

      {/* Sign-out overlay animation - matches 'Now I'll remember you too' pink gradient page */}
      {isSigningOut && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #FFF1F7 0%, #FFE4F0 50%, #FFD6E8 100%)', // Match greeting page gradient
          }}
        >
          <motion.p
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-pink-900/90 text-2xl md:text-3xl lg:text-4xl font-serif italic text-center px-6 max-w-3xl"
            style={{
              fontFamily: '"EB Garamond", "Georgia", serif',
              letterSpacing: '0.02em',
              lineHeight: '1.4',
            }}
          >
            Until we meet again...
          </motion.p>
        </motion.div>
      )}
    </>
  );
}

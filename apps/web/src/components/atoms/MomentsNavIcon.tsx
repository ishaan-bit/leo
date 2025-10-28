'use client';

import { motion } from 'framer-motion';

type Props = {
  onClick: () => void;
};

export default function MomentsNavIcon({ onClick }: Props) {
  return (
    <motion.div
      className="fixed left-2 md:left-4 z-[100] flex items-center gap-2 pointer-events-none"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={{
        top: 'max(1rem, env(safe-area-inset-top))', // Aligned with top navigation
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="relative rounded-full text-sm shadow-md border pointer-events-auto
          border-white/40 backdrop-blur-md bg-white/35 hover:bg-white/60 hover:scale-110
          focus:outline-none focus:ring-2 focus:ring-pink-300/60 
          transition-all duration-300 group"
        style={{ 
          minWidth: '36px', 
          minHeight: '36px', 
          padding: '8px',
        }}
        aria-label="Go to Living City of Moments"
      >
        {/* City skyline icon */}
        <div className="relative z-10 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-gray-700 group-hover:text-purple-600 transition-colors"
          >
            {/* Simple skyline representation */}
            <path
              d="M3 20V12H6V20H3Z"
              fill="currentColor"
              opacity="0.6"
            />
            <path
              d="M8 20V8H11V20H8Z"
              fill="currentColor"
              opacity="0.8"
            />
            <path
              d="M13 20V10H16V20H13Z"
              fill="currentColor"
              opacity="0.7"
            />
            <path
              d="M18 20V6H21V20H18Z"
              fill="currentColor"
              opacity="0.9"
            />
            {/* Base line */}
            <line
              x1="2"
              y1="20"
              x2="22"
              y2="20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Subtle glow on hover */}
        <motion.div
          className="absolute inset-0 rounded-full bg-purple-300/20 -z-10 opacity-0 group-hover:opacity-100"
          transition={{ duration: 0.3 }}
        />
      </button>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, x: -5 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="text-xs text-white/90 bg-gray-800/80 backdrop-blur-sm pointer-events-none
          px-3 py-1.5 rounded-full shadow-lg border border-white/10 whitespace-nowrap"
        role="tooltip"
        style={{
          fontFamily: '"Inter", -apple-system, sans-serif',
          fontWeight: 500,
        }}
      >
        Living City of Moments
      </motion.div>
    </motion.div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface DreamLetterNudgeProps {
  pigName: string;
  onDismiss: () => void;
}

export default function DreamLetterNudge({ pigName, onDismiss }: DreamLetterNudgeProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for animation to complete
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed left-14 md:left-20 z-[99] pointer-events-auto"
          initial={{ opacity: 0, x: -10, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{
            top: 'max(1rem, env(safe-area-inset-top))',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
          }}
        >
          <div className="relative">
            {/* Pointer triangle to Living City icon */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full"
              style={{
                width: 0,
                height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: '8px solid rgba(139, 92, 246, 0.15)',
                filter: 'drop-shadow(-1px 0 2px rgba(139, 92, 246, 0.1))',
              }}
            />
            
            {/* Main message */}
            <motion.div
              className="relative px-4 py-2.5 rounded-2xl shadow-lg border backdrop-blur-md max-w-[200px]"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,232,255,0.95))',
                borderColor: 'rgba(139, 92, 246, 0.2)',
              }}
              animate={{
                boxShadow: [
                  '0 4px 12px rgba(139, 92, 246, 0.2)',
                  '0 6px 20px rgba(139, 92, 246, 0.3)',
                  '0 4px 12px rgba(139, 92, 246, 0.2)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <p
                className="text-xs leading-relaxed text-purple-900 font-medium"
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  letterSpacing: '0.01em',
                }}
              >
                Your Dream Letter from <span className="font-semibold">{pigName}</span> is waiting
              </p>
              
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200
                  border border-purple-300 flex items-center justify-center transition-all duration-200
                  hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1"
                aria-label="Dismiss notification"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-purple-600"
                >
                  <path
                    d="M1 1L9 9M1 9L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

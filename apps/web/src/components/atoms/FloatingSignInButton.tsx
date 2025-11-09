'use client';

import { motion } from 'framer-motion';

interface FloatingSignInButtonProps {
  onClick: () => void;
}

export default function FloatingSignInButton({ onClick }: FloatingSignInButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:via-rose-600 hover:to-pink-700 text-white px-5 py-3.5 rounded-full font-medium shadow-2xl hover:shadow-pink-500/60 transition-all duration-300 flex items-center gap-2.5 border border-pink-400/20"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <span className="text-xl">✨</span>
      <span className="text-sm font-semibold tracking-wide">Sign in</span>
    </motion.button>
  );
}

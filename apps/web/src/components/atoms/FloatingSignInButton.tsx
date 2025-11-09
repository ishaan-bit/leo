'use client';

import { motion } from 'framer-motion';

interface FloatingSignInButtonProps {
  onClick: () => void;
}

export default function FloatingSignInButton({ onClick }: FloatingSignInButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 py-3 rounded-full font-medium shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 flex items-center gap-2"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <span className="text-lg">💾</span>
      <span>Sign in</span>
    </motion.button>
  );
}

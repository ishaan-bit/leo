/**
 * /guest/confirmed - Guest 5s Settle Screen
 * 
 * "So it's settled. I am {pigName}. I'll remember that… wherever you find me again"
 * Auto-redirects to /reflect after 5s
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PinkPig from '@/components/molecules/PinkPig';
import { useRouter } from 'next/navigation';

export default function GuestConfirmedPage() {
  const router = useRouter();
  const [pigName, setPigName] = useState<string | null>(null);

  useEffect(() => {
    // Get guest pig name from localStorage
    const name = localStorage.getItem('leo_pig_name_local');
    if (!name) {
      router.push('/start');
      return;
    }
    
    setPigName(name);

    // Auto-redirect after 5s
    const timer = setTimeout(() => {
      router.push('/reflect');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  if (!pigName) {
    return null;
  }

  return (
    <section 
      className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Calm gradient */}
      <motion.div 
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, #fce7f3, #e9d5ff, #fbcfe8)',
          backgroundSize: '200% 200%'
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'linear'
        }}
      />

      {/* Animated pig floating upward */}
      <motion.div
        className="absolute left-1/2 z-10 pointer-events-none"
        style={{
          x: '-50%',
          top: '20%',
        }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ 
          opacity: 1, 
          y: -30,
        }}
        transition={{ 
          duration: 2, 
          ease: 'easeOut',
        }}
      >
        <PinkPig size={180} state="happy" />
      </motion.div>

      {/* Settle text */}
      <motion.div
        className="text-center space-y-4 max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
      >
        <motion.p
          className="text-pink-800 text-xl md:text-2xl font-serif italic leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
        >
          So it's settled.
        </motion.p>
        
        <motion.p
          className="text-pink-900 text-2xl md:text-3xl font-serif italic leading-relaxed"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, duration: 1.2 }}
        >
          I am <span className="text-pink-600 font-bold">{pigName}</span>.
        </motion.p>

        <motion.p
          className="text-pink-700 text-base md:text-lg font-serif italic leading-relaxed pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0, duration: 1 }}
        >
          I'll remember that… wherever you find me again
        </motion.p>
      </motion.div>

      {/* Subtle progress indicator */}
      <motion.div
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 3, duration: 0.5 }}
      >
        <div className="w-32 h-1 bg-pink-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-pink-400 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </section>
  );
}

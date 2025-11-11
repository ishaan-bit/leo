/**
 * /guest/confirmed - 5s Settle Screen (Guest)
 * 
 * Shows "So it's settled. I am {pigName}. I'll remember that… wherever you find me again"
 * Auto-transitions to /guest/moment after 5 seconds with CSS blend
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PinkPig from '@/components/molecules/PinkPig';

export default function GuestConfirmedPage() {
  const router = useRouter();
  const [pigName, setPigName] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Get pig name from localStorage
    const storedName = localStorage.getItem('guest_pig_name');
    if (!storedName) {
      // No pig name found, redirect to start
      router.replace('/start');
      return;
    }
    setPigName(storedName);

    // Auto-transition after 5 seconds
    const timer = setTimeout(() => {
      setIsTransitioning(true);
      // Wait for transition animation, then navigate to reflect
      setTimeout(() => {
        router.push(`/reflect/${pigName}`);
      }, 600); // Match transition duration
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  if (!pigName) {
    return null; // Redirecting...
  }

  return (
    <motion.section 
      className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
      }}
      initial={{ opacity: 1, filter: 'blur(0px)' }}
      animate={{ 
        opacity: isTransitioning ? 0 : 1,
        filter: isTransitioning ? 'blur(10px)' : 'blur(0px)'
      }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Animated gradient atmosphere */}
      <motion.div 
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, #fce7f3, #fed7aa, #e9d5ff, #fbcfe8)',
          backgroundSize: '400% 400%'
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'linear'
        }}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none -z-5">
        {[...Array(12)].map((_, i) => {
          const size = 2 + Math.random() * 3;
          const colors = ['bg-pink-200/30', 'bg-peach-200/30', 'bg-purple-200/30', 'bg-rose-200/30'];
          const color = colors[i % colors.length];
          return (
            <motion.div
              key={i}
              className={`absolute rounded-full ${color}`}
              style={{
                width: size,
                height: size,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                filter: 'blur(1px)'
              }}
              animate={{
                y: [0, -120 - Math.random() * 60, 0],
                x: [0, (Math.random() - 0.5) * 40, 0],
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 10 + Math.random() * 8,
                repeat: Infinity,
                delay: i * 0.6,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </div>

      {/* Animated pig */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: 1, 
          opacity: 1,
        }}
        transition={{ 
          duration: 1,
          ease: [0.34, 1.56, 0.64, 1]
        }}
        className="mb-12"
      >
        <PinkPig 
          size={160} 
          state="happy"
        />
      </motion.div>

      {/* Settle copy (exact wording required) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="text-center max-w-md space-y-4"
      >
        <p className="font-serif text-2xl md:text-3xl text-pink-900 leading-relaxed italic">
          So it's settled.
        </p>
        <p className="font-serif text-2xl md:text-3xl text-pink-900 leading-relaxed italic">
          I am <span className="font-semibold text-rose-600">{pigName}</span>.
        </p>
        <p className="font-serif text-2xl md:text-3xl text-pink-900 leading-relaxed italic mt-6">
          I'll remember that… wherever you find me again
        </p>
      </motion.div>
    </motion.section>
  );
}

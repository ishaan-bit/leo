/**
 * /guest/city - One-Moment Living City (Guest)
 * 
 * Shows only the single moment the guest shared
 * TTL enforcement: Check purge time, if expired redirect to /start
 * Auto-purge cleanup on mount/unmount
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PinkPig from '@/components/molecules/PinkPig';

export default function GuestCityPage() {
  const router = useRouter();
  const [pigName, setPigName] = useState<string>('');
  const [moment, setMoment] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    // Check if guest session is valid
    const storedName = localStorage.getItem('guest_pig_name');
    const storedMoment = localStorage.getItem('guest_moment');
    const purgeTime = localStorage.getItem('guest_purge_time');
    
    if (!storedName || !storedMoment || !purgeTime) {
      // No valid guest session, redirect to start
      router.replace('/start');
      return;
    }

    const purgeTimeNum = parseInt(purgeTime);
    const remaining = purgeTimeNum - Date.now();

    // Check if session has expired
    if (remaining <= 0) {
      // Session expired, purge and redirect
      purgeGuestData();
      router.replace('/start');
      return;
    }

    setPigName(storedName);
    setMoment(storedMoment);
    setTimeRemaining(remaining);

    // Set up countdown timer
    const interval = setInterval(() => {
      const newRemaining = purgeTimeNum - Date.now();
      if (newRemaining <= 0) {
        // Time's up! Purge and redirect
        purgeGuestData();
        router.replace('/start');
      } else {
        setTimeRemaining(newRemaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  const purgeGuestData = () => {
    console.log('[Guest] Auto-purge: Clearing guest session');
    localStorage.removeItem('guest_pig_name');
    localStorage.removeItem('guest_moment');
    localStorage.removeItem('guest_session_id');
    localStorage.removeItem('guest_purge_time');
  };

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!pigName || !moment) {
    return null; // Redirecting...
  }

  return (
    <section 
      className="relative min-h-[100dvh] w-full overflow-hidden px-6 py-12"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
      }}
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

      <div className="max-w-4xl mx-auto">
        {/* Header with timer */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl md:text-5xl text-pink-900 italic mb-4">
            Living City
          </h1>
          <p className="font-sans text-pink-700/70 text-sm mb-2">
            Guest session as {pigName}
          </p>
          <p className="font-sans text-rose-600 text-sm font-medium">
            Time remaining: {formatTimeRemaining(timeRemaining)}
          </p>
        </motion.div>

        {/* Single moment card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border-2 border-pink-200"
        >
          {/* Pig avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-300 to-rose-300 flex items-center justify-center">
              <PinkPig size={48} state="idle" />
            </div>
            <div>
              <p className="font-sans font-semibold text-pink-900 text-lg">{pigName}</p>
              <p className="font-sans text-pink-700/70 text-sm">Guest</p>
            </div>
          </div>

          {/* Moment text */}
          <p className="font-sans text-pink-900 text-lg leading-relaxed whitespace-pre-wrap">
            {moment}
          </p>

          {/* Timestamp */}
          <p className="font-sans text-pink-700/50 text-sm mt-6">
            Just now
          </p>
        </motion.div>

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="font-sans text-pink-700/70 text-sm italic">
            This is a guest session. Your moment will disappear in {formatTimeRemaining(timeRemaining)}.
          </p>
          <p className="font-sans text-pink-700/70 text-sm italic mt-2">
            Sign in to save your moments forever.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

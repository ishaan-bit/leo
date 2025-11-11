/**
 * /guest/moment - Collect One Reflection (Guest)
 * 
 * Guest shares a single moment/reflection
 * Saves to Upstash under guest session (TTL=180s)
 * Routes to /guest/city
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function GuestMomentPage() {
  const router = useRouter();
  const [moment, setMoment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pigName, setPigName] = useState<string>('');

  useEffect(() => {
    // Check if guest session is valid
    const storedName = localStorage.getItem('guest_pig_name');
    const purgeTime = localStorage.getItem('guest_purge_time');
    
    if (!storedName || !purgeTime) {
      // No valid guest session, redirect to start
      router.replace('/start');
      return;
    }

    // Check if session has expired
    if (Date.now() > parseInt(purgeTime)) {
      // Session expired, purge and redirect
      localStorage.removeItem('guest_pig_name');
      localStorage.removeItem('guest_session_id');
      localStorage.removeItem('guest_purge_time');
      router.replace('/start');
      return;
    }

    setPigName(storedName);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const guestSessionId = localStorage.getItem('guest_session_id');
      if (!guestSessionId) {
        throw new Error('No guest session found');
      }

      // Save moment to Upstash
      const res = await fetch('/api/guest/moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_session_id: guestSessionId,
          moment: moment.trim(),
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Failed to save moment');
        setIsSubmitting(false);
        return;
      }

      // Save to localStorage for display
      localStorage.setItem('guest_moment', moment.trim());

      console.log('[Guest] Moment saved');
      
      // Route to city
      router.push('/guest/city');
    } catch (err) {
      console.error('[Guest] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!pigName) {
    return null; // Redirecting...
  }

  return (
    <section 
      className="relative flex flex-col items-center justify-center min-h-[100dvh] w-full overflow-hidden px-6 py-12"
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

      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl text-pink-900 italic mb-2">
            Share a moment
          </h1>
          <p className="font-sans text-pink-700/70 text-sm">
            As {pigName}
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="space-y-4"
        >
          <textarea
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full min-h-[200px] py-4 px-6 font-sans text-lg text-pink-900 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-pink-200 focus:border-pink-400 focus:outline-none transition-all resize-none"
            autoFocus
            disabled={isSubmitting}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-rose-600 text-sm text-center font-sans"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !moment.trim()}
            className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </motion.form>
      </div>
    </section>
  );
}

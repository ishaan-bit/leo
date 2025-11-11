/**
 * /app/moment - Share a Moment (Signed-in)
 * 
 * Authenticated user shares a moment/reflection
 * Persists to database
 * Routes to /app/city (or existing city page)
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function AppMomentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [moment, setMoment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pigName, setPigName] = useState<string>('');

  useEffect(() => {
    // Must be signed in to access this page
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.replace('/start');
      return;
    }

    // Fetch user's pig
    const fetchPig = async () => {
      try {
        const res = await fetch('/api/pig/me');
        if (res.ok) {
          const data = await res.json();
          if (data.pigName) {
            setPigName(data.pigName);
          } else {
            // No pig found, redirect to naming
            router.replace('/app/name-pig');
          }
        } else {
          // No pig found, redirect to naming
          router.replace('/app/name-pig');
        }
      } catch (err) {
        console.error('[App Moment] Error fetching pig:', err);
        router.replace('/app/name-pig');
      }
    };

    fetchPig();
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Save moment via API
      const res = await fetch('/api/moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moment: moment.trim(),
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Failed to save moment');
        setIsSubmitting(false);
        return;
      }

      console.log('[App] Moment saved');
      
      // Route to city page (using existing reflect page)
      router.push(`/reflect/${pigName}`);
    } catch (err) {
      console.error('[App] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || !session || !pigName) {
    return null; // Loading or redirecting...
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

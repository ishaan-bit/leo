/**
 * /app/name-pig - Name Your Pig (Signed-in First Time)
 * 
 * For authenticated users who don't have a pig yet
 * Creates persistent pig in database
 * Routes to /app/confirmed after naming
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PinkPig from '@/components/molecules/PinkPig';

export default function AppNamePigPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [pigName, setPigName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Must be signed in to access this page
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.replace('/start');
    }
  }, [session, status, router]);

  const validatePigName = (name: string): string | null => {
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (name.length > 20) return 'Name must be 20 characters or less';
    if (!/^[a-z0-9_-]+$/i.test(name)) return 'Only letters, numbers, hyphens, and underscores allowed';
    
    // Simple profanity check
    const blocked = ['fuck', 'shit', 'damn', 'ass', 'bitch'];
    if (blocked.some(word => name.toLowerCase().includes(word))) {
      return 'Please choose a different name';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pigName.trim() || isSubmitting) return;

    const trimmedName = pigName.trim();
    const validationError = validatePigName(trimmedName);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create persistent pig via API
      const res = await fetch('/api/pig/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pigName: trimmedName,
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Failed to save pig name');
        setIsSubmitting(false);
        return;
      }

      console.log('[App] Pig created:', trimmedName);
      
      // Route to confirmed screen
      router.push('/app/confirmed');
    } catch (err) {
      console.error('[App] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || !session) {
    return null; // Loading or redirecting...
  }

  return (
    <section 
      className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
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
        initial={{ y: 100, opacity: 0 }}
        animate={{ 
          y: 0, 
          opacity: 1,
        }}
        transition={{ 
          y: { duration: 1.2, ease: [0.34, 1.56, 0.64, 1] },
          opacity: { duration: 0.8 },
        }}
        className="mb-8"
      >
        <PinkPig 
          size={180} 
          state="idle"
        />
      </motion.div>

      {/* "Name me" prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-center mb-8"
      >
        <h1 className="font-serif text-3xl md:text-4xl text-pink-900 italic">
          Name me
        </h1>
      </motion.div>

      {/* Input form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="w-full max-w-sm space-y-4"
      >
        <input
          type="text"
          value={pigName}
          onChange={(e) => setPigName(e.target.value)}
          placeholder="Enter a name..."
          className="w-full py-4 px-6 text-center font-sans text-lg text-pink-900 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-pink-200 focus:border-pink-400 focus:outline-none transition-all"
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
          disabled={isSubmitting || !pigName.trim()}
          className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </motion.form>

      {/* Helper text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="mt-6 text-pink-700/70 text-sm text-center font-sans max-w-xs"
      >
        2-20 characters • Letters, numbers, hyphens, underscores
      </motion.p>
    </section>
  );
}

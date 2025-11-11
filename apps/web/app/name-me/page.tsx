/**
 * Name Me - First Touch Experience
 * 
 * Route: /name-me
 * 
 * Where all users (guest or authenticated) name their pig for the first time.
 * After naming, shows CTA to bind for cross-device persistence.
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { submitPigName } from './actions';

export default function NameMePage() {
  const [pigName, setPigName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBindCta, setShowBindCta] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await submitPigName(pigName);

    if (result.success) {
      // Show bind CTA before redirect
      if (result.isGuest && process.env.NEXT_PUBLIC_BIND_ENABLED === 'true') {
        setShowBindCta(true);
        // Redirect after 3 seconds if user doesn't click bind
        setTimeout(() => {
          window.location.href = result.redirectTo || '/city';
        }, 3000);
      } else {
        // Direct redirect for authenticated users
        window.location.href = result.redirectTo || '/city';
      }
    } else {
      setError(result.error || 'Failed to save name');
      setIsSubmitting(false);
    }
  };

  const handleBind = () => {
    // Redirect to bind flow (email magic link)
    window.location.href = '/bind?next=/city';
  };

  const handleSkipBind = () => {
    window.location.href = '/city';
  };

  if (showBindCta) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/50 p-8 text-center space-y-6"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-7xl"
          >
            🪽
          </motion.div>

          <h2 className="text-2xl font-serif text-pink-900">
            Keep {pigName} on all your devices?
          </h2>

          <p className="text-pink-700 text-sm">
            Sign in with email to access your pig from anywhere—phone, laptop, or tablet.
          </p>

          <div className="flex flex-col gap-3">
            <motion.button
              onClick={handleBind}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Yes, keep my pig everywhere ✨
            </motion.button>

            <button
              onClick={handleSkipBind}
              className="text-sm text-pink-600 hover:text-pink-800 underline"
            >
              Maybe later, continue on this device only
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="max-w-md w-full bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/50 p-8"
      >
        {/* Floating pig animation */}
        <motion.div
          animate={{
            y: [0, -15, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-8xl text-center mb-6"
        >
          🐷
        </motion.div>

        <h1 className="text-3xl font-serif text-center text-pink-900 mb-2">
          Name Me
        </h1>

        <p className="text-center text-pink-700 mb-8 text-sm italic">
          Your winged companion awaits a name...
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={pigName}
              onChange={(e) => setPigName(e.target.value)}
              placeholder="Enter a name (2-24 characters)"
              maxLength={24}
              className="w-full px-4 py-3 rounded-full border-2 border-pink-200 focus:border-pink-400 focus:outline-none bg-white/50 text-pink-900 placeholder-pink-400 text-center font-serif text-lg transition-all"
              disabled={isSubmitting}
              autoFocus
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-2 text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting || pigName.trim().length < 2}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  ⏳
                </motion.span>
                Saving...
              </span>
            ) : (
              'Begin Your Journey'
            )}
          </motion.button>
        </form>

        <p className="text-center text-pink-500 text-xs mt-6">
          This name will be yours across all sessions
        </p>
      </motion.div>
    </main>
  );
}

/**
 * Bind Flow - Keep Your Pig on All Devices
 * 
 * Route: /bind?next=<redirect>
 * 
 * Allows guest users to sign in and promote their pig to authenticated scope.
 * Uses NextAuth email provider for magic link sign-in.
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function BindPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/city';

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: `/bind/callback?next=${encodeURIComponent(next)}`,
      });

      if (result?.error) {
        setError('Failed to send magic link. Please try again.');
        setIsSubmitting(false);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    await signIn('google', {
      callbackUrl: `/bind/callback?next=${encodeURIComponent(next)}`,
    });
  };

  if (emailSent) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/50 p-8 text-center space-y-6"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="text-7xl"
          >
            📧
          </motion.div>

          <h2 className="text-2xl font-serif text-pink-900">
            Check your email
          </h2>

          <p className="text-pink-700 text-sm">
            We sent a magic link to <strong>{email}</strong>.
            Click the link to sign in and keep your pig on all devices.
          </p>

          <div className="pt-4 border-t border-pink-200">
            <p className="text-xs text-pink-500">
              Didn't receive it? Check your spam folder or try again.
            </p>
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
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-7xl text-center mb-6"
        >
          🪽
        </motion.div>

        <h1 className="text-3xl font-serif text-center text-pink-900 mb-2">
          Keep Your Pig Everywhere
        </h1>

        <p className="text-center text-pink-700 mb-8 text-sm">
          Sign in to access your pig from any device
        </p>

        <div className="space-y-4">
          {/* Google Sign In */}
          <motion.button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-pink-200 text-pink-900 font-medium py-3 px-6 rounded-full shadow-md hover:shadow-lg hover:border-pink-300 transition-all duration-300 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </motion.button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-pink-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 text-pink-500">or</span>
            </div>
          </div>

          {/* Email Sign In */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-full border-2 border-pink-200 focus:border-pink-400 focus:outline-none bg-white/50 text-pink-900 placeholder-pink-400 text-center transition-all"
              disabled={isSubmitting}
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending magic link...' : 'Continue with Email'}
            </motion.button>
          </form>

          <button
            onClick={() => window.location.href = next}
            className="w-full text-sm text-pink-600 hover:text-pink-800 underline py-2"
          >
            Skip for now
          </button>
        </div>

        <p className="text-center text-pink-500 text-xs mt-6">
          Your pig stays safe on this device until you sign in
        </p>
      </motion.div>
    </main>
  );
}

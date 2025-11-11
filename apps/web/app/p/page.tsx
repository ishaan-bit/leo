/**
 * Unified Landing Page - Name Your Pig + Fetch My Pig
 * 
 * Route: /p
 * 
 * This is the ONE QR entry point for all users:
 * - First-time users: Name your pig → proceed to reflection
 * - Returning users (signed in): Fetch existing pig → proceed to reflection
 * - Guest users: Name pig temporarily → single moment → purge
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

export default function PigLandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [pigName, setPigName] = useState('');
  const [mode, setMode] = useState<'name' | 'fetch' | 'auth'>('name');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpFlow, setIsOtpFlow] = useState(false);

  // Check if user already has a pig
  useEffect(() => {
    async function checkExistingPig() {
      if (status === 'loading') return;
      
      try {
        const res = await fetch('/api/effective');
        if (!res.ok) return;
        
        const identity = await res.json();
        
        // If user already has a pig, redirect to reflect
        if (identity.pigName) {
          console.log('[Landing] User already has pig, redirecting to reflect');
          router.push('/reflect');
        }
      } catch (err) {
        console.error('[Landing] Error checking existing pig:', err);
      }
    }
    
    checkExistingPig();
  }, [status, router]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pigName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('[Landing] Submitting pig name:', pigName.trim());
      
      // Save pig name
      const payload = { pigName: pigName.trim() };
      console.log('[Landing] Request payload:', payload);
      
      const saveRes = await fetch('/api/pig/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[Landing] Save response status:', saveRes.status);

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        console.error('[Landing] Save error:', errorData);
        setError(errorData.error || 'Failed to save pig name');
        setIsSubmitting(false);
        return;
      }

      const result = await saveRes.json();
      console.log('[Landing] Success:', result);

      // Success - redirect to reflect
      console.log('[Landing] Pig named successfully:', pigName.trim());
      router.push('/reflect');
    } catch (err) {
      console.error('[Landing] Error naming pig:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleFetchPig = async () => {
    if (!session?.user) {
      // Must be signed in to fetch pig
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/pig/fetch');
      if (!res.ok) {
        const { error: fetchError } = await res.json();
        setError(fetchError || 'No existing pig found');
        setIsSubmitting(false);
        return;
      }

      const { pigName: fetchedName } = await res.json();
      console.log('[Landing] Fetched existing pig:', fetchedName);
      
      // Redirect to reflect
      router.push('/reflect');
    } catch (err) {
      console.error('[Landing] Error fetching pig:', err);
      setError('Failed to fetch pig');
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (provider: 'google' | 'apple' | 'phone') => {
    if (provider === 'phone') {
      setIsOtpFlow(true);
      return;
    }

    await signIn(provider, {
      callbackUrl: '/p', // Return here after auth
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      if (!res.ok) {
        const { error: otpError } = await res.json();
        setError(otpError || 'Failed to send verification code');
        setIsSubmitting(false);
        return;
      }

      console.log('[Landing] OTP sent to:', phoneNumber);
      setOtpSent(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error('[Landing] Error sending OTP:', err);
      setError('Failed to send verification code');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Sign in with phone OTP credentials
      const result = await signIn('phone-otp', {
        phoneNumber: phoneNumber.trim(),
        code: otpCode.trim(),
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result?.ok) {
        console.log('[Landing] Phone OTP sign-in successful');
        // Will trigger the useEffect to check for existing pig
        setIsOtpFlow(false);
        setOtpSent(false);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('[Landing] Error verifying OTP:', err);
      setError('Failed to verify code');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-10"
      >
        {/* Floating Pig Icon */}
        <motion.div
          animate={{
            y: [0, -15, 0],
            rotate: [0, 5, 0, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-8xl text-center mb-8"
        >
          🐷
        </motion.div>

        {/* Mode Toggle - VERY VISIBLE */}
        {!isOtpFlow && (
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setMode('name')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                mode === 'name'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
              }`}
            >
              Name New Pig
            </button>
            <button
              onClick={() => setMode('fetch')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                mode === 'fetch'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
              }`}
            >
              Fetch My Pig
            </button>
          </div>
        )}

        <h1 className="text-4xl font-serif text-center text-purple-900 mb-3">
          {isOtpFlow ? 'Sign In with Phone' : mode === 'name' ? 'Name Your Pig' : 'Fetch Your Pig'}
        </h1>

        <p className="text-center text-purple-600 mb-8 text-sm leading-relaxed">
          {isOtpFlow
            ? 'Enter your phone number to receive a verification code'
            : mode === 'name' 
            ? 'Your pig will hold your reflections'
            : 'Sign in to retrieve your existing pig from any device'}
        </p>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name Your Pig Form */}
        {mode === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={pigName}
                onChange={(e) => setPigName(e.target.value)}
                placeholder="Enter pig name..."
                maxLength={20}
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-white border-2 border-purple-200 rounded-2xl text-purple-900 placeholder-purple-400 focus:outline-none focus:border-purple-400 transition-all duration-300 text-center text-lg font-medium disabled:opacity-50"
                autoFocus
              />
            </div>

            <motion.button
              type="submit"
              disabled={!pigName.trim() || isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </motion.button>
          </form>
        )}

        {/* Fetch Pig Flow */}
        {mode === 'fetch' && !isOtpFlow && (
          <div className="space-y-6">
            {!session?.user ? (
              <>
                <p className="text-center text-purple-700 text-sm mb-6">
                  Sign in to retrieve your existing pig from any device
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => handleSignIn('google')}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-purple-200 text-purple-900 font-medium py-3 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-purple-300 transition-all duration-300"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>

                  <button
                    onClick={() => handleSignIn('phone')}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-purple-200 text-purple-900 font-medium py-3 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-purple-300 transition-all duration-300"
                  >
                    <span className="text-xl">📱</span>
                    Sign in with Phone
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-center text-purple-700 text-sm mb-6">
                  Retrieving your existing pig...
                </p>

                <button
                  onClick={handleFetchPig}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all duration-300"
                >
                  {isSubmitting ? 'Fetching...' : 'Fetch My Pig'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setMode('name');
                setError(null);
              }}
              className="w-full text-purple-600 hover:text-purple-800 font-medium py-3 rounded-xl hover:bg-purple-50 transition-all duration-300"
            >
              ← Back to Name Pig
            </button>
          </div>
        )}

        {/* Phone OTP Flow */}
        {isOtpFlow && (
          <div className="space-y-6">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <p className="text-center text-purple-700 text-sm mb-4">
                  Enter your phone number to receive a verification code
                </p>

                <div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    disabled={isSubmitting}
                    className="w-full px-6 py-4 bg-white border-2 border-purple-200 rounded-2xl text-purple-900 placeholder-purple-400 focus:outline-none focus:border-purple-400 transition-all duration-300 text-center text-lg font-medium disabled:opacity-50"
                    autoFocus
                  />
                  <p className="text-xs text-purple-500 text-center mt-2">
                    Use international format (e.g., +1 for US)
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={!phoneNumber.trim() || isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {isSubmitting ? 'Sending...' : 'Send Code'}
                </motion.button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <p className="text-center text-purple-700 text-sm mb-4">
                  Enter the verification code sent to<br />
                  <span className="font-semibold">{phoneNumber}</span>
                </p>

                <div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    disabled={isSubmitting}
                    className="w-full px-6 py-4 bg-white border-2 border-purple-200 rounded-2xl text-purple-900 placeholder-purple-400 focus:outline-none focus:border-purple-400 transition-all duration-300 text-center text-2xl font-mono tracking-widest disabled:opacity-50"
                    autoFocus
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={otpCode.length !== 6 || isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Code'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setError(null);
                  }}
                  className="w-full text-purple-600 hover:text-purple-800 font-medium py-3 rounded-xl hover:bg-purple-50 transition-all duration-300 text-sm"
                >
                  Resend code
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOtpFlow(false);
                setOtpSent(false);
                setPhoneNumber('');
                setOtpCode('');
                setError(null);
              }}
              className="w-full text-purple-600 hover:text-purple-800 font-medium py-3 rounded-xl hover:bg-purple-50 transition-all duration-300"
            >
              ← Back
            </button>
          </div>
        )}

        <p className="text-center text-purple-400 text-xs mt-8">
          {session?.user 
            ? 'Your pig will be saved permanently' 
            : 'Guest mode: Only one moment will be saved'}
        </p>
      </motion.div>
    </main>
  );
}

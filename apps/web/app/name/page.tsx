/**
 * /name - Name Your Pig (Fresh Device)
 * 
 * Two options:
 * 1. Name a new pig (guest mode or sign-in to claim)
 * 2. Fetch existing pig (requires sign-in)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';

export default function NamePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [mode, setMode] = useState<'name' | 'fetch'>('name');
  const [pigName, setPigName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpFlow, setIsOtpFlow] = useState(false);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pigName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get or create device_uid
      let deviceUid = localStorage.getItem('leo_guest_uid');
      if (!deviceUid) {
        deviceUid = uuidv4();
        localStorage.setItem('leo_guest_uid', deviceUid);
      }
      // Ensure deviceUid is non-null
      const finalDeviceUid = deviceUid as string;

      // Initialize guest pig
      const res = await fetch('/api/guest/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceUid: finalDeviceUid,
          pigName: pigName.trim(),
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Failed to save pig name');
        setIsSubmitting(false);
        return;
      }

      // Save locally for same-device fast-path
      localStorage.setItem('leo_pig_name_local', pigName.trim());

      console.log('[Name] Guest pig created:', pigName.trim());
      
      // Redirect to reflect (guest mode)
      router.push('/reflect');
    } catch (err) {
      console.error('[Name] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleFetchPig = async (provider: 'google' | 'apple' | 'phone') => {
    if (provider === 'phone') {
      setIsOtpFlow(true);
      return;
    }

    await signIn(provider, {
      callbackUrl: '/app', // After sign-in, go to app (will show pig list)
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
        setError(otpError || 'Failed to send code');
        setIsSubmitting(false);
        return;
      }

      setOtpSent(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error('[Name] OTP send error:', err);
      setError('Failed to send code');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
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
        router.push('/app');
      }
    } catch (err) {
      console.error('[Name] OTP verify error:', err);
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
        {/* Floating Pig */}
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

        {/* Mode Toggle */}
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
          {isOtpFlow ? 'Sign In' : mode === 'name' ? 'Name Your Pig' : 'Fetch Your Pig'}
        </h1>

        <p className="text-center text-purple-600 mb-8 text-sm leading-relaxed">
          {isOtpFlow
            ? 'Enter your phone number'
            : mode === 'name'
            ? 'Your pig will hold your reflections'
            : 'Sign in to retrieve your pig'}
        </p>

        {/* Error Message */}
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

        {/* Name Mode */}
        {!isOtpFlow && mode === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
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

            <motion.button
              type="submit"
              disabled={!pigName.trim() || isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? 'Saving...' : 'Continue as Guest'}
            </motion.button>

            <p className="text-center text-purple-400 text-xs">
              Sign in later to save across devices
            </p>
          </form>
        )}

        {/* Fetch Mode */}
        {!isOtpFlow && mode === 'fetch' && (
          <div className="space-y-4">
            <p className="text-center text-purple-700 text-sm mb-6">
              Sign in to access your pig from any device
            </p>

            <button
              onClick={() => handleFetchPig('google')}
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
              onClick={() => handleFetchPig('phone')}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-purple-200 text-purple-900 font-medium py-3 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-purple-300 transition-all duration-300"
            >
              <span className="text-xl">📱</span>
              Sign in with Phone
            </button>
          </div>
        )}

        {/* Phone OTP Flow */}
        {isOtpFlow && !otpSent && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              disabled={isSubmitting}
              className="w-full px-6 py-4 bg-white border-2 border-purple-200 rounded-2xl text-purple-900 placeholder-purple-400 focus:outline-none focus:border-purple-400 transition-all duration-300 text-center text-lg font-medium disabled:opacity-50"
              autoFocus
            />

            <motion.button
              type="submit"
              disabled={!phoneNumber.trim() || isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? 'Sending...' : 'Send Code'}
            </motion.button>

            <button
              type="button"
              onClick={() => setIsOtpFlow(false)}
              className="w-full text-purple-600 hover:text-purple-800 font-medium py-3 rounded-xl hover:bg-purple-50 transition-all duration-300"
            >
              ← Back
            </button>
          </form>
        )}

        {isOtpFlow && otpSent && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <p className="text-center text-purple-700 text-sm mb-4">
              Code sent to {phoneNumber}
            </p>

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

            <motion.button
              type="submit"
              disabled={otpCode.length !== 6 || isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </motion.button>

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtpCode('');
              }}
              className="w-full text-purple-600 hover:text-purple-800 font-medium py-3 rounded-xl hover:bg-purple-50 transition-all duration-300 text-sm"
            >
              Resend code
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}

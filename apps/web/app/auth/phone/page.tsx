/**
 * /auth/phone - Phone OTP Sign-in
 * 
 * Simple phone authentication page
 * After successful auth, redirects to /app/confirmed
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import PinkPig from '@/components/molecules/PinkPig';

export default function AuthPhonePage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Send OTP via credentials provider
      const result = await signIn('credentials', {
        phone: phoneNumber,
        action: 'send-otp',
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else {
        setOtpSent(true);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('[Auth Phone] Error sending OTP:', err);
      setError('Failed to send OTP. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Verify OTP
      const result = await signIn('credentials', {
        phone: phoneNumber,
        otp: otpCode,
        action: 'verify-otp',
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else if (result?.ok) {
        // Success! Redirect to confirmed
        console.log('[Auth Phone] Sign-in successful, redirecting to /app/confirmed');
        router.push('/app/confirmed');
      }
    } catch (err) {
      console.error('[Auth Phone] Error verifying OTP:', err);
      setError('Failed to verify OTP. Please try again.');
      setIsSubmitting(false);
    }
  };

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
          size={160} 
          state="idle"
        />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-3xl md:text-4xl text-pink-900 italic">
          {otpSent ? 'Enter code' : 'Sign in with Phone'}
        </h1>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="w-full max-w-sm"
      >
        {!otpSent ? (
          // Phone number entry
          <form onSubmit={handleSendOTP} className="space-y-4">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
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
              disabled={isSubmitting || !phoneNumber}
              className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? 'Sending...' : 'Send Code'}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full py-3 px-6 text-pink-700 font-sans text-sm hover:text-pink-900 transition-colors"
            >
              Back
            </button>
          </form>
        ) : (
          // OTP verification
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-center font-sans text-pink-700/70 text-sm mb-4">
              Code sent to {phoneNumber}
            </p>

            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full py-4 px-6 text-center font-sans text-2xl tracking-widest text-pink-900 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-pink-200 focus:border-pink-400 focus:outline-none transition-all"
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
              disabled={isSubmitting || otpCode.length !== 6}
              className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtpCode('');
                setError(null);
              }}
              className="w-full py-3 px-6 text-pink-700 font-sans text-sm hover:text-pink-900 transition-colors"
            >
              Change number
            </button>
          </form>
        )}
      </motion.div>
    </section>
  );
}

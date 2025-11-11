'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PinkPig from '@/components/molecules/PinkPig';

export default function PhoneAuthPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Failed to send OTP');
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      
      // In development, show the OTP code
      if (data.dev_otp) {
        setDevOtp(data.dev_otp);
      }

      setOtpSent(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error('[PhoneAuth] Send OTP error:', err);
      setError('Failed to send OTP. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.trim(),
          code: otpCode.trim()
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError || 'Invalid OTP');
        setIsSubmitting(false);
        return;
      }

      // OTP verified - redirect to /name
      router.push('/name');
    } catch (err) {
      console.error('[PhoneAuth] Verify OTP error:', err);
      setError('Failed to verify OTP. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <section 
      className="relative flex flex-col items-center justify-between h-[100dvh] w-full overflow-hidden"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Animated gradient */}
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

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md flex-1 flex flex-col items-center justify-center space-y-8 py-8 px-6">
        
        {/* Pig Character */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: -5, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <PinkPig size={200} state="idle" />
        </motion.div>

        {/* Form */}
        <motion.div
          className="w-full space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <h2 className="text-center text-pink-900 text-xl font-serif italic">
            {otpSent ? 'Enter the code we sent you' : 'Sign in with your phone'}
          </h2>

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full rounded-full border-2 border-pink-200/60 text-center text-pink-900 shadow-lg placeholder-pink-400/70 focus:outline-none focus:border-pink-300 transition-all py-4 px-6"
                style={{ 
                  fontSize: '16px',
                  background: 'rgba(255,255,255,0.9)',
                }}
                required
                disabled={isSubmitting}
              />

              <motion.button
                type="submit"
                disabled={!phoneNumber.trim() || isSubmitting}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-semibold shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? 'Sending...' : 'Send Code'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {devOtp && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-pink-100 border-2 border-pink-300 rounded-2xl p-4 mb-4"
                >
                  <p className="text-pink-800 text-sm font-serif italic text-center mb-2">
                    🔐 Development Mode
                  </p>
                  <p className="text-pink-900 text-2xl font-bold text-center tracking-wider">
                    {devOtp}
                  </p>
                  <p className="text-pink-600 text-xs text-center mt-2">
                    (Twilio not configured - use this code)
                  </p>
                </motion.div>
              )}
              
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-full border-2 border-pink-200/60 text-center text-pink-900 shadow-lg placeholder-pink-400/70 focus:outline-none focus:border-pink-300 transition-all py-4 px-6 text-2xl tracking-widest"
                style={{ 
                  fontSize: '24px',
                  background: 'rgba(255,255,255,0.9)',
                  letterSpacing: '0.5em'
                }}
                required
                maxLength={6}
                disabled={isSubmitting}
                autoFocus
              />

              <motion.button
                type="submit"
                disabled={otpCode.length !== 6 || isSubmitting}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-semibold shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
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
                className="w-full text-pink-600 hover:text-pink-800 text-sm underline"
              >
                Change phone number
              </button>
            </form>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-600 text-sm text-center px-4"
            >
              {error}
            </motion.div>
          )}

          <button
            onClick={() => router.push('/start')}
            className="w-full text-pink-600 hover:text-pink-800 text-sm underline pt-4"
          >
            ← Back to start
          </button>
        </motion.div>
      </div>
    </section>
  );
}

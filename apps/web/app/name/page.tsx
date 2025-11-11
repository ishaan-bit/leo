/**
 * /name - Name Your Pig (Fresh Device)
 * 
 * Poetic naming experience with cinematic entrance
 * Two modes: Name New Pig | Fetch My Pig
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import PinkPig from '@/components/molecules/PinkPig';

export default function NamePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [mode, setMode] = useState<'name' | 'fetch'>('name');
  const [pigName, setPigName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Cinematic entrance states
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showLine3, setShowLine3] = useState(false);
  const [showLine4, setShowLine4] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [pigHeadTilt, setPigHeadTilt] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpFlow, setIsOtpFlow] = useState(false);

  // Cinematic entrance sequence (only for name mode)
  useEffect(() => {
    if (mode === 'name') {
      const timers = [
        setTimeout(() => setShowLine1(true), 800),
        setTimeout(() => setShowLine2(true), 2200),
        setTimeout(() => setPigHeadTilt(true), 3200),
        setTimeout(() => setShowLine3(true), 3800),
        setTimeout(() => setShowLine4(true), 4600),
        setTimeout(() => setShowInputField(true), 5400),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [mode]);

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
      
      // Show confetti celebration
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        // Redirect to reflect (guest mode)
        router.push('/reflect');
      }, 2000);
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

    // Sign in first, then check for pig
    const result = await signIn(provider, {
      redirect: false,
    });

    if (result?.ok) {
      // Check if user has a pig
      await checkUserPig();
    }
  };

  const checkUserPig = async () => {
    try {
      const res = await fetch('/api/effective');
      if (!res.ok) {
        setError('No pig found for this account');
        setTimeout(() => {
          setMode('name');
          setError(null);
        }, 2000);
        return;
      }

      const identity = await res.json();
      
      if (!identity.pigName) {
        setError('No pig found for this account');
        setTimeout(() => {
          setMode('name');
          setError(null);
        }, 2000);
        return;
      }

      // Success - redirect to reflect
      router.push('/reflect');
    } catch (err) {
      console.error('[Fetch] Error checking pig:', err);
      setError('No pig found for this account');
      setTimeout(() => {
        setMode('name');
        setError(null);
      }, 2000);
    }
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
        console.log('[Name] Phone OTP sign-in successful');
        setIsOtpFlow(false);
        setOtpSent(false);
        setIsSubmitting(false);
        // Check if user has a pig
        await checkUserPig();
      }
    } catch (err) {
      console.error('[Name] OTP verify error:', err);
      setError('Failed to verify code');
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

      {/* Confetti celebration */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {[...Array(24)].map((_, i) => {
            const angle = (Math.PI * 2 * i) / 24;
            const distance = 150 + Math.random() * 100;
            const colors = ['bg-pink-400', 'bg-rose-400', 'bg-purple-400', 'bg-yellow-300', 'bg-blue-300'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            return (
              <motion.div
                key={`confetti-${i}`}
                className={`absolute w-3 h-3 ${color} rounded-full`}
                style={{
                  left: '50%',
                  top: '40%',
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance - 50,
                  opacity: 0,
                  scale: [0, 1.5, 0.5],
                  rotate: Math.random() * 360,
                }}
                transition={{
                  duration: 1.2,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
              />
            );
          })}
        </div>
      )}

      {/* Mode toggle - only show if not in OTP flow */}
      {!isOtpFlow && (
        <motion.div
          className="relative z-10 w-full max-w-lg flex gap-3 px-6 pt-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <button
            onClick={() => setMode('name')}
            className={`flex-1 py-2 px-4 rounded-full font-medium text-sm transition-all duration-300 ${
              mode === 'name'
                ? 'bg-pink-600 text-white shadow-lg'
                : 'bg-white/60 text-pink-700 hover:bg-white/80'
            }`}
          >
            Name New Pig
          </button>
          <button
            onClick={() => setMode('fetch')}
            className={`flex-1 py-2 px-4 rounded-full font-medium text-sm transition-all duration-300 ${
              mode === 'fetch'
                ? 'bg-pink-600 text-white shadow-lg'
                : 'bg-white/60 text-pink-700 hover:bg-white/80'
            }`}
          >
            Fetch My Pig
          </button>
        </motion.div>
      )}

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-center space-y-3 py-8">
        
        {/* NAME MODE - Poetic Experience */}
        {mode === 'name' && (
          <>
            {/* Pig Character */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ 
                y: pigHeadTilt ? -5 : 0, 
                opacity: 1,
                rotate: pigHeadTilt ? 3 : 0
              }}
              transition={{ 
                y: { duration: 1.2, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { duration: 0.8 },
                rotate: { duration: 0.6, delay: 3.2 }
              }}
              className="mb-0"
            >
              <PinkPig 
                size={240} 
                state="idle"
                onInputFocus={isInputFocused}
              />
            </motion.div>

            {/* Sequential dialogue reveal */}
            <motion.div
              className="flex flex-col gap-3 items-center text-center px-6 max-w-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              {showLine1 && (
                <motion.p
                  className="text-pink-800 text-base font-serif italic"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  They say pigs can't fly.
                </motion.p>
              )}

              {showLine2 && (
                <motion.p
                  className="text-pink-800 text-base font-serif italic"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  Yet here I am — waiting for someone to believe I could.
                </motion.p>
              )}

              {showLine3 && (
                <motion.p
                  className="text-pink-800 text-base font-serif italic mt-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  I don't have a name yet.
                </motion.p>
              )}

              {showLine4 && (
                <motion.p
                  className="text-pink-800 text-base font-serif italic"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  Would you lend me one?
                </motion.p>
              )}
            </motion.div>

            {/* Magical input field */}
            {showInputField && (
              <motion.form
                onSubmit={handleNameSubmit}
                className="flex flex-col items-center gap-4 w-full pb-8 mt-6 px-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.8,
                  type: 'spring',
                  stiffness: 120,
                  damping: 15
                }}
              >
                <div className="relative w-full max-w-sm">
                  {/* Ambient shimmer */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(251,207,232,0.4) 0%, transparent 70%)',
                      filter: 'blur(20px)',
                    }}
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.4, 0.7, 0.4],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  {/* Input field */}
                  <input
                    type="text"
                    value={pigName}
                    onChange={(e) => setPigName(e.target.value)}
                    placeholder="Give me a name I'll remember…"
                    className="relative w-full rounded-full border-2 border-pink-200/60 text-center text-pink-900 shadow-xl placeholder-pink-400/70 focus:outline-none focus:border-pink-300 transition-all"
                    style={{ 
                      fontSize: '16px', 
                      minHeight: '64px',
                      background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,245,255,0.8) 100%)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 8px 32px rgba(251,113,133,0.15)',
                      fontFamily: "'DM Serif Text', serif",
                    }}
                    required
                    minLength={2}
                    maxLength={30}
                    disabled={isSubmitting}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                  />

                  {/* Typing shimmer */}
                  {isInputFocused && (
                    <motion.div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(251,207,232,0.6), transparent)',
                        backgroundSize: '200% 100%',
                      }}
                      animate={{
                        backgroundPosition: ['-200% 0', '200% 0'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  )}
                </div>

                {/* Mode selection buttons */}
                <div className="flex gap-3 w-full">
                  <motion.button
                    type="submit"
                    disabled={!pigName.trim() || isSubmitting}
                    className="flex-1 py-3 px-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isSubmitting ? 'Saving...' : 'Name New Pig'}
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => setMode('fetch')}
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-6 rounded-full bg-white/80 backdrop-blur-sm border-2 border-pink-300 text-pink-700 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Fetch My Pig
                  </motion.button>
                </div>

                {/* Error message */}
                <AnimatePresence>
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
                </AnimatePresence>
              </motion.form>
            )}
          </>
        )}

        {/* FETCH MODE - Sign-in Options (with same poetic design) */}
        {mode === 'fetch' && !isOtpFlow && (
          <>
            {/* Pig Character - same entrance animation */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ 
                y: -5, 
                opacity: 1,
                rotate: 3
              }}
              transition={{ 
                y: { duration: 1.2, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { duration: 0.8 },
                rotate: { duration: 0.6 }
              }}
              className="mb-4"
            >
              <PinkPig 
                size={240} 
                state="idle"
              />
            </motion.div>

            {/* Poetic text for fetch mode */}
            <motion.div
              className="flex flex-col gap-3 items-center text-center px-6 max-w-md mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <motion.p
                className="text-pink-800 text-base font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.8 }}
              >
                I remember you.
              </motion.p>
              <motion.p
                className="text-pink-800 text-base font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.4 }}
              >
                Sign in, and I'll find my way back to you.
              </motion.p>
            </motion.div>

            <motion.div
              className="w-full max-w-md px-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.0, duration: 0.8 }}
            >
              <div className="space-y-4">
              <button
                onClick={() => handleFetchPig('google')}
                className="w-full flex items-center justify-center gap-3 bg-white/80 backdrop-blur-sm border-2 border-pink-200 text-pink-900 font-medium py-3 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-pink-300 transition-all duration-300"
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
                className="w-full flex items-center justify-center gap-3 bg-white/80 backdrop-blur-sm border-2 border-pink-200 text-pink-900 font-medium py-3 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-pink-300 transition-all duration-300"
              >
                <span className="text-xl">📱</span>
                Sign in with Phone
              </button>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 text-red-600 text-sm text-center px-4"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            </motion.div>
          </>
        )}

        {/* PHONE OTP FLOW (with same poetic design) */}
        {isOtpFlow && (
          <>
            {/* Pig Character - same entrance animation */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ 
                y: -5, 
                opacity: 1,
                rotate: 3
              }}
              transition={{ 
                y: { duration: 1.2, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { duration: 0.8 },
                rotate: { duration: 0.6 }
              }}
              className="mb-6"
            >
              <PinkPig 
                size={240} 
                state="idle"
              />
            </motion.div>

            <motion.div
              className="w-full max-w-md px-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <h2 className="text-2xl font-serif text-pink-800 text-center">
                  Sign In with Phone
                </h2>

                <p className="text-center text-pink-700 text-sm mb-4">
                  Enter your phone number
                </p>

                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  disabled={isSubmitting}
                  className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-2xl text-pink-900 placeholder-pink-400 focus:outline-none focus:border-pink-400 transition-all duration-300 text-center text-lg font-medium disabled:opacity-50"
                  autoFocus
                />

                <motion.button
                  type="submit"
                  disabled={!phoneNumber.trim() || isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {isSubmitting ? 'Sending...' : 'Send Code'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOtpFlow(false);
                    setError(null);
                  }}
                  className="w-full text-pink-600 hover:text-pink-800 font-medium py-3 rounded-xl hover:bg-white/50 transition-all duration-300"
                >
                  ← Back
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <h2 className="text-2xl font-serif text-pink-800 text-center">
                  Enter Code
                </h2>

                <p className="text-center text-pink-700 text-sm mb-4">
                  Code sent to {phoneNumber}
                </p>

                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  maxLength={6}
                  disabled={isSubmitting}
                  className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-2xl text-pink-900 placeholder-pink-400 focus:outline-none focus:border-pink-400 transition-all duration-300 text-center text-2xl font-mono tracking-widest disabled:opacity-50"
                  autoFocus
                />

                <motion.button
                  type="submit"
                  disabled={otpCode.length !== 6 || isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                  }}
                  className="w-full text-pink-600 hover:text-pink-800 font-medium py-3 rounded-xl hover:bg-white/50 transition-all duration-300 text-sm"
                >
                  Resend code
                </button>
              </form>
            )}

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 text-red-600 text-sm text-center px-4"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}

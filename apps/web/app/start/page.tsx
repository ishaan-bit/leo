/**
 * /start - Universal QR Entry Point (Ultra-Simple Auth + Onboarding)
 * 
 * Single URL for all users (QR codes point here)
 * Always shows Sign-In screen with hero text + 3 CTAs
 * 
 * Hero text (must be shown):
 * "They say pigs can't fly.
 *  Yet here I am — waiting for someone to believe I could."
 * 
 * CTAs (exact order):
 * 1. Continue as Guest
 * 2. Sign in with Google
 * 3. Sign in with Phone No
 */

'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import PinkPig from '@/components/molecules/PinkPig';

export default function StartPage() {
  const router = useRouter();

  const handleGuestFlow = () => {
    router.push('/guest/name-pig');
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/app/confirmed' });
  };

  const handlePhoneSignIn = () => {
    router.push('/auth/phone');
  };

  return (
    <section 
      className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
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
          size={200} 
          state="idle"
        />
      </motion.div>

      {/* Hero text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-center mb-12 max-w-md"
      >
        <p className="font-display text-2xl md:text-3xl text-pink-900 leading-relaxed italic">
          They say pigs can't fly.
        </p>
        <p className="font-display text-2xl md:text-3xl text-pink-900 leading-relaxed italic mt-2">
          Yet here I am — waiting for someone to believe I could.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* CTA 1: Continue as Guest */}
        <button
          onClick={handleGuestFlow}
          className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          Continue as Guest
        </button>

        {/* CTA 2: Sign in with Google */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-4 px-6 bg-white text-pink-900 font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-pink-200"
        >
          Sign in with Google
        </button>

        {/* CTA 3: Sign in with Phone No */}
        <button
          onClick={handlePhoneSignIn}
          className="w-full py-4 px-6 bg-white text-pink-900 font-sans font-medium text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 border-pink-200"
        >
          Sign in with Phone No
        </button>
      </motion.div>
    </section>
  );
}

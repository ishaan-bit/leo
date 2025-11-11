/**
 * /start - Landing Page (QR Entry Point)
 * 
 * Single URL for all users
 * 2 options: Continue as Guest | Sign in with Google
 */

'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import PinkPig from '@/components/molecules/PinkPig';

export default function StartPage() {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: '/name' });
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

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-center space-y-8 py-8 px-6">
        
        {/* Pig Character */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: -5, opacity: 1, rotate: 3 }}
          transition={{ 
            y: { duration: 1.2, ease: [0.34, 1.56, 0.64, 1] },
            opacity: { duration: 0.8 },
            rotate: { duration: 0.6 }
          }}
        >
          <PinkPig size={280} state="idle" />
        </motion.div>

        {/* Hero text */}
        <motion.div
          className="flex flex-col gap-3 items-center text-center max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          <motion.p
            className="font-serif text-base md:text-lg text-pink-800 italic"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0 }}
          >
            They say pigs can't fly.
          </motion.p>

          <motion.p
            className="font-serif text-base md:text-lg text-pink-800 italic"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.6 }}
          >
            Yet here I am — waiting for someone to believe I could.
          </motion.p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="w-full max-w-md space-y-4 pt-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.2, duration: 0.8 }}
        >
          <motion.button
            onClick={() => router.push('/guest/name-pig')}
            className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-semibold py-4 px-8 rounded-full shadow-xl hover:shadow-2xl hover:from-pink-600 hover:via-rose-600 hover:to-pink-700 transition-all duration-300 border-2 border-pink-300/50"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            Continue as Guest
          </motion.button>

          <motion.button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white/95 backdrop-blur-sm border-2 border-pink-200/80 text-pink-900 font-semibold py-4 px-8 rounded-full shadow-lg hover:shadow-xl hover:border-pink-300 hover:bg-pink-50/50 transition-all duration-300"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </motion.button>

          <p className="text-center text-pink-600/80 text-sm font-serif italic pt-2">
            Sign in so your pigs on the wing remembers you
          </p>
        </motion.div>
      </div>
    </section>
  );
}

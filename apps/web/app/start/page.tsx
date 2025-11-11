/**
 * /start - Landing Page (QR Entry Point)
 * 
 * Single URL for all users
 * Two options: Guest OR Sign In
 */

'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PinkPig from '@/components/molecules/PinkPig';

export default function StartPage() {
  const router = useRouter();

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
            className="font-serif text-2xl md:text-3xl text-pink-900 italic"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0 }}
          >
            They say pigs can't fly.
          </motion.p>

          <motion.p
            className="font-serif text-2xl md:text-3xl text-pink-900 italic"
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
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Continue as Guest
          </motion.button>

          <motion.button
            onClick={() => router.push('/name?mode=fetch')}
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-pink-200 text-pink-900 font-semibold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:border-pink-300 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Sign In
          </motion.button>

          <p className="text-center text-pink-600 text-sm italic pt-2">
            Guest mode: Your pig will be remembered for 3 minutes
          </p>
        </motion.div>
      </div>
    </section>
  );
}

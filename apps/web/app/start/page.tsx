/**
 * /start - Landing Page (QR Entry Point)
 * 
 * Single URL for all users
 * 2 options: Continue as Guest | Sign in with Google
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import PinkPig from '@/components/molecules/PinkPig';
import LegalModal from '@/components/organisms/LegalModal';

// Animation sequence states
type IntroState = 'quieten-reveal' | 'd-insertion' | 'alphabet-fade' | 'monogram-converge' | 'landing-reveal' | 'complete';

export default function StartPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showRememberMessage, setShowRememberMessage] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [introState, setIntroState] = useState<IntroState>('quieten-reveal');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    // If reduced motion, skip directly to landing
    if (mediaQuery.matches) {
      setIntroState('complete');
    }
  }, []);

  // Orchestrate brand reveal sequence - Simplified for Q+D convergence
  useEffect(() => {
    if (prefersReducedMotion) return;

    const timers: NodeJS.Timeout[] = [];

    // Simplified sequence: Q+D appear → converge with "life cab for" → landing
    timers.push(setTimeout(() => setIntroState('monogram-converge'), 900));  // After Q+D meet
    timers.push(setTimeout(() => setIntroState('landing-reveal'), 1700));    // After "life cab for" appears
    timers.push(setTimeout(() => setIntroState('complete'), 1900));          // Mark complete

    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  const handleGoogleSignIn = async () => {
    setShowRememberMessage(true);
    
    // Wait 2s to show message, then proceed with sign-in
    setTimeout(async () => {
      await signIn('google', { callbackUrl: '/name' });
    }, 2000);
  };

  const handleGuestMode = async () => {
    // If user is already signed in, sign them out first to ensure true guest mode
    if (session) {
      await signOut({ redirect: false });
    }
    // Navigate to guest naming flow
    router.push('/guest/name-pig');
  };

  // Show "Now I'll remember you too..." message before auth
  if (showRememberMessage) {
    return (
      <section 
        className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <motion.div 
          className="fixed inset-0 -z-10"
          style={{
            background: 'linear-gradient(135deg, #fce7f3, #e9d5ff, #fbcfe8)',
            backgroundSize: '200% 200%'
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p className="text-pink-800 text-base md:text-lg font-serif italic leading-relaxed">
            Now I'll remember you too...
          </p>
        </motion.div>
      </section>
    );
  }

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

      {/* QuietDen Brand Reveal Sequence - New: Q+D convergence with "life cab for" */}
      <AnimatePresence>
        {introState !== 'complete' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Vertical stack: "life cab for" above QD monogram */}
            <div className="relative flex flex-col items-center justify-center gap-2">
              
              {/* "life cab for" text - appears after Q+D converge */}
              <motion.div
                className="text-sm md:text-base font-serif tracking-widest text-rose-700"
                style={{ letterSpacing: '0.3em', fontWeight: 400 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: introState === 'monogram-converge' ? 1 : 0,
                  y: introState === 'monogram-converge' ? 0 : 10,
                }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                life cab for
              </motion.div>

              {/* QD Monogram - Q from center-left, D from center-right */}
              <div className="relative flex items-center justify-center">
                {/* Q - arrives from center-left */}
                <motion.span
                  className="font-serif text-5xl md:text-6xl tracking-wider text-rose-900"
                  style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}
                  initial={{ opacity: 0, x: -80 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  transition={{ 
                    opacity: { duration: 0.6 },
                    x: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
                  }}
                >
                  Q
                </motion.span>

                {/* D - arrives from center-right */}
                <motion.span
                  className="font-serif text-5xl md:text-6xl tracking-wider text-rose-900"
                  style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}
                  initial={{ opacity: 0, x: 80 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  transition={{ 
                    opacity: { duration: 0.6 },
                    x: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
                  }}
                >
                  D
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main landing content - shows after brand reveal completes (no QD monogram needed) */}
      {(introState === 'landing-reveal' || introState === 'complete' || prefersReducedMotion) && (
        <motion.div 
          className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-start space-y-4 py-4 px-6"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: prefersReducedMotion ? 0 : 0.3 }}
        >
          
          {/* "A QuietDen Experience" tagline */}
          <motion.p
            className="font-serif text-sm md:text-base text-pink-700/90 tracking-wider"
            style={{ letterSpacing: '0.15em' }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.5 }}
          >
            A QuietDen Experience
          </motion.p>

          {/* Pig Character */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { y: 60, opacity: 0 }}
            animate={{ y: -5, opacity: 1, rotate: 3 }}
            transition={prefersReducedMotion ? { duration: 0 } : { 
              y: { duration: 1.0, ease: [0.34, 1.56, 0.64, 1] },
              opacity: { duration: 0.8 },
              rotate: { duration: 0.6 }
            }}
          >
            <PinkPig size={280} state="idle" />
          </motion.div>

          {/* Hero text - 3 lines closer to pig */}
          <motion.div
            className="flex flex-col gap-2 items-center text-center max-w-md -mt-6"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.6, duration: 0.8 }}
          >
            <motion.p
              className="font-serif text-base md:text-lg text-pink-800 italic"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: prefersReducedMotion ? 0 : 0.8 }}
            >
              They say pigs can't fly.
            </motion.p>

            <motion.p
              className="font-serif text-base md:text-lg text-pink-800 italic"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: prefersReducedMotion ? 0 : 1.0 }}
            >
              Yet here I am;
            </motion.p>

            <motion.p
              className="font-serif text-base md:text-lg text-pink-800 italic"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: prefersReducedMotion ? 0 : 1.2 }}
            >
              Waiting for someone to believe I could.
            </motion.p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="w-full max-w-md space-y-4 pt-2"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 1.6, duration: 0.8 }}
          >
            <motion.button
              onClick={handleGuestMode}
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
              Let me Remember you
            </motion.button>

            {/* Consent Line */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 1.8, duration: 0.6 }}
              className="text-left pt-1 -ml-2"
            >
              <p className="text-xs text-pink-500/60 font-normal leading-none">
                By continuing, you agree to our <button onClick={() => setShowLegalModal(true)} className="text-xs underline hover:text-pink-800 transition-colors cursor-pointer">Terms</button> & <button onClick={() => setShowLegalModal(true)} className="text-xs underline hover:text-pink-800 transition-colors cursor-pointer">Privacy Policy</button>.
              </p>
            </motion.div>

            {/* Existing tiny note + Copyright */}
            <div className="space-y-1">
              <p className="text-center text-pink-600/80 text-sm font-serif italic">
                If you lose me, scan my mark again; I'll come flying back.
              </p>
              
              {/* Copyright line */}
              <p className="text-center text-pink-500/60 text-xs">
                © QuietDen (OPC) Pvt. Ltd. 2025
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Legal Modal */}
      <LegalModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} />
    </section>
  );
}

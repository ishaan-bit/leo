'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import PinkPig from '../molecules/PinkPig';
import SpeechBubble from '../atoms/SpeechBubble';
import SoundToggle from '../atoms/SoundToggle';

interface PigRitualBlockProps {
  pigId: string;
  initialName?: string | null;
}

export default function PigRitualBlock({ pigId, initialName }: PigRitualBlockProps) {
  const [hasNamed, setHasNamed] = useState(!!initialName);
  const [pigName, setPigName] = useState(initialName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialName);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showSuccessTransition, setShowSuccessTransition] = useState(false);

  // Trigger entrance sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch pig state on mount if not provided
  useEffect(() => {
    if (!initialName) {
      fetchPigState();
    }
  }, [pigId, initialName]);

  async function fetchPigState() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/pig/${pigId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.named && data.name) {
          setPigName(data.name);
          setHasNamed(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pig state:', err);
      setError('Could not load pig state');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string)?.trim();
    
    if (!name || name.length < 2) {
      setError('I need something to remember.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/pig/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pigId, name }),
      });

      if (res.ok) {
        const data = await res.json();
        setPigName(data.name);
        
        // Play success chime
        try {
          if (typeof window !== 'undefined' && 'AudioContext' in window) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Create a pleasant chime (C major chord arpeggio)
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
          }
        } catch (audioErr) {
          console.warn('Could not play audio chime:', audioErr);
        }
        
        // Show confetti celebration
        setShowConfetti(true);
        
        // Trigger happy state and wait 2s before showing post-naming screen
        setTimeout(() => {
          setHasNamed(true);
          setShowConfetti(false);
        }, 2000);
      } else {
        const errorData = await res.json();
        if (res.status === 400 && errorData.error?.toLowerCase().includes('already named')) {
          setError("Ah... someone's already named me.");
        } else {
          setError('Something went wrong. Could you try again?');
        }
      }
    } catch (err) {
      console.error('Error saving pig name:', err);
      setError("I couldn't remember that. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle "Continue as Guest" button
  async function handleContinueAsGuest() {
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
      });

      if (res.ok) {
        // Instant fade to reflection - frictionless
        window.location.href = `/reflect/${pigId}`;
      } else {
        setError('Could not create guest session');
        setIsAuthenticating(false);
      }
    } catch (err) {
      console.error('Error creating guest session:', err);
      setError('Something went wrong');
      setIsAuthenticating(false);
    }
  }

  // Handle "Sign in with Google" button
  async function handleGoogleSignIn() {
    setIsAuthenticating(true);
    try {
      // Show success transition before redirecting
      setShowSuccessTransition(true);
      
      // Wait for user to see the message
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Redirect to Google OAuth with callback to reflection page
      await signIn('google', { 
        callbackUrl: `/reflect/${pigId}` 
      });
    } catch (err) {
      console.error('Error signing in with Google:', err);
      setError('Could not sign in');
      setIsAuthenticating(false);
      setShowSuccessTransition(false);
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <section className="relative flex flex-col items-center justify-center h-[100dvh] px-4 pt-safe pb-safe">
        <PinkPig size={240} className="animate-pulse" />
        <p className="text-pink-700/60 mt-8 animate-pulse">Loading...</p>
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
      {/* Animated gradient atmosphere - fills entire viewport */}
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

      {/* Floating particles atmosphere */}
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

      {/* Confetti celebration on successful naming */}
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
                  ease: [0.34, 1.56, 0.64, 1], // easeOutBack
                }}
              />
            );
          })}
        </div>
      )}

      {/* Main content wrapper - tighter spacing for mobile */}
      <div className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-center space-y-3 py-8">
        {/* Pig Character with top breathing room - entrance animation */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ 
            duration: 0.8, 
            delay: 0.3,
            ease: [0.34, 1.56, 0.64, 1] // easeOutBack
          }}
          className="mb-0"
        >
          <PinkPig 
            size={240} 
            state={hasNamed ? 'happy' : 'idle'} 
            onInputFocus={isInputFocused}
          />
        </motion.div>

        {/* Speech Bubble - entrance animation with spring */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: 0.6,
            duration: 0.5,
            type: 'spring',
            stiffness: 200,
            damping: 20
          }}
        >
          <SpeechBubble 
            text={
              showConfetti 
                ? `Thank you.\nI'll remember this name.`
                : !hasNamed 
                  ? "They say pigs can't fly.\nYet here I am - waiting for someone to believe I could.\nI don't have a name yet.\nWould you lend me one?"
                  : `So it's settled.\nI am ${pigName}.\nI'll remember that… wherever you find me again.`
            }
            isThinking={isSubmitting && !showConfetti}
          />
        </motion.div>

        {/* Form or Post-naming Content - stays above safe area */}
        {!hasNamed ? (
          <motion.form
            onSubmit={handleNameSubmit}
            className="flex flex-col items-center gap-3 w-full pb-8 mt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: 1.5, 
              duration: 0.6,
              ease: 'easeOut'
            }}
          >
            <motion.input
              type="text"
              name="name"
              placeholder="Give me a name I'll remember…"
              className="w-full max-w-sm rounded-2xl border border-white/40 text-center text-pink-900 shadow-lg placeholder-pink-400/60 focus:outline-none transition-all"
              style={{ 
                fontSize: '16px', 
                minHeight: '56px',
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 4px 16px rgba(251,113,133,0.1)'
              }}
              required
              minLength={2}
              disabled={isSubmitting}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              whileFocus={{ 
                scale: 1.02,
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 0 0 3px rgba(251,113,133,0.2), 0 4px 20px rgba(251,113,133,0.2)'
              }}
            />
            {error && (
              <motion.p
                className="text-sm text-rose-600 italic"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="relative rounded-full bg-gradient-to-r from-rose-500 to-pink-400 text-white px-10 font-semibold shadow-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                fontSize: '18px', 
                minHeight: '56px', 
                paddingTop: '16px', 
                paddingBottom: '16px',
                fontFamily: "'DM Serif Text', Georgia, serif",
                boxShadow: '0 0 20px rgba(251, 113, 133, 0.4), 0 8px 24px rgba(251, 113, 133, 0.3)'
              }}
              animate={{
                boxShadow: isSubmitting ? '0 0 20px rgba(251, 113, 133, 0.4)' : [
                  '0 0 20px rgba(251, 113, 133, 0.4), 0 8px 24px rgba(251, 113, 133, 0.3)',
                  '0 0 30px rgba(251, 113, 133, 0.6), 0 8px 24px rgba(251, 113, 133, 0.4)',
                  '0 0 20px rgba(251, 113, 133, 0.4), 0 8px 24px rgba(251, 113, 133, 0.3)'
                ]
              }}
              transition={{
                boxShadow: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }}
              whileHover={{ 
                scale: isSubmitting ? 1 : 1.05,
                boxShadow: '0 0 40px rgba(251, 113, 133, 0.7), 0 8px 32px rgba(251, 113, 133, 0.5)'
              }}
              whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
            >
              <span className="flex items-center gap-2 justify-center">
                {!isSubmitting && <span>✨</span>}
                {isSubmitting ? 'Naming...' : 'Name Me'}
              </span>
            </motion.button>
          </motion.form>
        ) : (
          // Post-naming scene with sequential text fade-ins and floating button animation
          <motion.div
            className="flex flex-col gap-6 items-center w-full max-w-md px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Sequential text reveal - line by line */}
            <div className="flex flex-col gap-3 items-center text-center">
              <motion.p
                className="text-pink-900 text-lg font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                So it's settled.
              </motion.p>
              <motion.p
                className="text-pink-900 text-xl font-serif font-semibold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                I am {pigName}.
              </motion.p>
              <motion.p
                className="text-pink-700/80 text-base font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.5 }}
              >
                I'll remember that… wherever you find me again.
              </motion.p>
            </div>

            {/* Buttons float up like bubbles after 1.5s pause */}
            <motion.div
              className="flex flex-col gap-3 w-full items-center mt-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: 2.7, // 1.5s after last text + 0.6s for text animation + 0.6s buffer
                type: 'spring',
                stiffness: 80,
                damping: 12
              }}
            >
              {/* Continue as Guest - pale shimmer like moonlight */}
              <motion.button
                onClick={handleContinueAsGuest}
                disabled={isAuthenticating}
                className="relative rounded-full bg-white/70 backdrop-blur-md text-pink-900 px-10 py-3 font-medium shadow-lg border border-white/60 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{ 
                  minHeight: '52px',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '15px'
                }}
                whileHover={{ 
                  scale: isAuthenticating ? 1 : 1.03,
                  boxShadow: '0 8px 24px rgba(251, 207, 232, 0.4)'
                }}
                whileTap={{ scale: isAuthenticating ? 1 : 0.97 }}
              >
                {/* Moonlight shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'linear',
                    repeatDelay: 2
                  }}
                  style={{ width: '50%' }}
                />
                <span className="relative z-10">
                  {isAuthenticating ? 'Loading...' : 'Continue as Guest'}
                </span>
              </motion.button>

              {/* Sign in with Google - heartbeat glow with poetic copy */}
              <motion.button
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="relative rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white px-10 py-3 font-medium shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  minHeight: '52px',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '15px'
                }}
                animate={{
                  boxShadow: isAuthenticating ? '0 4px 16px rgba(251, 113, 133, 0.3)' : [
                    '0 0 20px rgba(251, 113, 133, 0.4), 0 4px 16px rgba(251, 113, 133, 0.3)',
                    '0 0 32px rgba(251, 113, 133, 0.6), 0 4px 20px rgba(251, 113, 133, 0.4)',
                    '0 0 20px rgba(251, 113, 133, 0.4), 0 4px 16px rgba(251, 113, 133, 0.3)'
                  ]
                }}
                transition={{
                  boxShadow: { 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: 'easeInOut' 
                  }
                }}
                whileHover={{ 
                  scale: isAuthenticating ? 1 : 1.03,
                  boxShadow: '0 0 40px rgba(251, 113, 133, 0.7), 0 6px 24px rgba(251, 113, 133, 0.5)'
                }}
                whileTap={{ scale: isAuthenticating ? 1 : 0.97 }}
              >
                {isAuthenticating ? 'Signing in...' : 'Let me remember you'}
              </motion.button>
            </motion.div>

            {/* Refined bottom hint - smaller, grayish lavender */}
            <motion.p
              className="text-pink-600/60 text-xs mt-6 text-center leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 3.2 }}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              If you lose me, scan my mark again — I'll come flying back.
            </motion.p>
          </motion.div>
        )}
      </div>

      {/* Sound toggle now positions itself - removed from here as it's in SoundToggle component */}
      <SoundToggle />

      {/* Success transition overlay - "Now I'll remember you, too" */}
      {showSuccessTransition && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-pink-50/95 backdrop-blur-sm z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.p
            className="text-pink-900 text-2xl font-serif italic text-center px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Now I'll remember you, too.
          </motion.p>
        </motion.div>
      )}
    </section>
  );
}

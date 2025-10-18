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
  
  // Cinematic entrance states
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showLine3, setShowLine3] = useState(false);
  const [showLine4, setShowLine4] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [pigHeadTilt, setPigHeadTilt] = useState(false);

  // Cinematic entrance sequence
  useEffect(() => {
    if (!initialName && !hasNamed) {
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
  }, [initialName, hasNamed]);

  // Trigger entrance sequence (original timer)
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
        {/* Pig Character - cinematic entrance: floats up from below with wing flutter */}
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
            state={hasNamed ? 'happy' : 'idle'} 
            onInputFocus={isInputFocused}
          />
        </motion.div>

        {/* Sequential dialogue reveal - line by line with pauses */}
        {!hasNamed && (
          <motion.div
            className="flex flex-col gap-3 items-center text-center px-6 max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {/* Line 1: "They say pigs can't fly." */}
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

            {/* Line 2: "Yet here I am; waiting for someone to believe I could." */}
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

            {/* Line 3: "I don't have a name yet." */}
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

            {/* Line 4: "Would you lend me one?" */}
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
        )}

        {/* Diegetic input field - magical orb that transforms into text input */}
        {!hasNamed && showInputField ? (
          <motion.form
            onSubmit={handleNameSubmit}
            className="flex flex-col items-center gap-4 w-full pb-8 mt-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              duration: 0.8,
              type: 'spring',
              stiffness: 120,
              damping: 15
            }}
          >
            {/* Magical whisper field - orb with shimmer */}
            <div className="relative w-full max-w-sm">
              {/* Ambient shimmer ring around input */}
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
              
              {/* Input field as orb */}
              <motion.input
                type="text"
                name="name"
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
                whileFocus={{
                  scale: 1.02,
                  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.9), 0 12px 40px rgba(251,113,133,0.25)',
                }}
              />

              {/* Typing shimmer effect - reacts to input */}
              {isInputFocused && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(251,207,232,0.6), transparent)',
                  }}
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              )}
            </div>

            {/* "Name Me" button with pulsing glow and particle trail on hover */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="relative rounded-full bg-gradient-to-r from-pink-400 to-rose-400 text-white px-12 py-4 font-semibold text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{
                fontFamily: "'Inter', sans-serif",
              }}
              animate={{
                scale: isSubmitting ? 1 : [1, 1.05, 1],
                boxShadow: isSubmitting 
                  ? '0 8px 32px rgba(251,113,133,0.3)'
                  : [
                      '0 8px 32px rgba(251,113,133,0.4)',
                      '0 12px 40px rgba(251,113,133,0.6)',
                      '0 8px 32px rgba(251,113,133,0.4)',
                    ]
              }}
              transition={{
                scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
              }}
              whileHover={{ 
                scale: isSubmitting ? 1 : 1.08,
                boxShadow: '0 16px 48px rgba(251,113,133,0.7)',
              }}
              whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
            >
              {/* Button press light dim effect */}
              <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                whileTap={{ opacity: 0.1 }}
                transition={{ duration: 0.1 }}
              />
              
              {/* Particle sparkle on hover */}
              <motion.div
                className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full"
                style={{ filter: 'blur(1px)' }}
                animate={{
                  x: [0, -20, -40],
                  y: [0, -10, -20],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              
              <span className="relative z-10">
                {isSubmitting ? 'Remembering...' : 'Name Me'}
              </span>
            </motion.button>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-600 text-sm italic"
              >
                {error}
              </motion.p>
            )}
          </motion.form>
        ) : null}

        {/* Post-naming scene - only show if hasNamed */}
        {hasNamed && (
          <motion.div
            className="flex flex-col gap-6 items-center w-full max-w-md px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Sequential text reveal - line by line */}
            <div className="flex flex-col gap-3 items-center text-center">
              <motion.p
                className="text-pink-800 text-base font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                So it's settled.
              </motion.p>
              <motion.p
                className="text-pink-800 text-base font-serif italic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                I am {pigName}.
              </motion.p>
              <motion.p
                className="text-pink-800 text-base font-serif italic"
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

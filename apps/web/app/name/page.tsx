/**
 * /name - Name Your Pig
 * 
 * Poetic naming experience with cinematic entrance
 * Flow: Name → Confetti → 5s Settle ("So it's settled. I am {name}.") → /reflect
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import PinkPig from '@/components/molecules/PinkPig';
import { playClickSound, playChimeSound } from '@/lib/sound';

export default function NamePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [pigName, setPigName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);

  // Cinematic entrance states
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showLine3, setShowLine3] = useState(false);
  const [showLine4, setShowLine4] = useState(false);
  const [showLine5, setShowLine5] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [pigHeadTilt, setPigHeadTilt] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSettle, setShowSettle] = useState(false);

  // Check if user already has a pig and redirect them
  useEffect(() => {
    async function checkExistingPig() {
      // Check for both NextAuth session (Google) and phone session
      const hasGoogleAuth = !!session?.user?.email;
      const hasPhoneAuth = document.cookie.includes('leo-phone-session');
      
      console.log('[Name] 🔍 Checking existing pig - Google:', hasGoogleAuth, 'Phone:', hasPhoneAuth);
      
      if (!hasGoogleAuth && !hasPhoneAuth) {
        // Guest user - no check needed
        console.log('[Name] 👤 Guest user detected - no existing pig check');
        setIsCheckingExisting(false);
        return;
      }

      try {
        const res = await fetch('/api/pig/me');
        if (res.ok) {
          const data = await res.json();
          if (data.pigId) {
            // User already has a pig - redirect to reflect page
            console.log('[Name] 🐷 RETURNING USER - Already has pig:', data.pigId, '- Skipping settle screen and redirecting immediately');
            router.push(`/reflect/${data.pigId}`);
            return;
          } else {
            console.log('[Name] ✨ NEW USER - No existing pig found, showing name form');
          }
        }
      } catch (err) {
        console.error('[Name] Error checking existing pig:', err);
      }
      
      setIsCheckingExisting(false);
    }

    checkExistingPig();
  }, [session, router]);

  // Cinematic entrance sequence (only if no existing pig)
  useEffect(() => {
    if (isCheckingExisting) return;
    
    const timers = [
      setTimeout(() => setShowLine1(true), 800),
      setTimeout(() => setShowLine2(true), 1800),
      setTimeout(() => setShowLine3(true), 2600),
      setTimeout(() => setPigHeadTilt(true), 3600),
      setTimeout(() => setShowLine4(true), 4200),
      setTimeout(() => setShowLine5(true), 5000),
      setTimeout(() => setShowInputField(true), 5800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isCheckingExisting]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pigName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Check if user is signed in
      if (session?.user) {
        // Signed-in user: create persistent pig
        const res = await fetch('/api/pig/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pigName: pigName.trim() }),
        });

        if (!res.ok) {
          const { error: apiError } = await res.json();
          setError(apiError || 'Failed to save pig name');
          setIsSubmitting(false);
          return;
        }

        const { pigId } = await res.json();

        // Save locally
        localStorage.setItem('leo_pig_name_local', pigName.trim());

        console.log('[Name] Pig created:', pigId, pigName.trim());
        
        // Show confetti celebration
        playChimeSound();
        setShowConfetti(true);
        console.log('[Name] ✨ Starting confetti animation');
        setTimeout(() => {
          setShowConfetti(false);
          // Show 5s settle screen
          setShowSettle(true);
          console.log('[Name] 🎯 Settle screen should now be visible (showSettle=true)');
          setTimeout(() => {
            console.log('[Name] ➡️ Redirecting to /reflect/', pigId);
            // Redirect to /reflect/[pigId]
            router.push(`/reflect/${pigId}`);
          }, 5000);
        }, 2000);
      } else {
        // Guest user: create ephemeral pig
        let deviceUid = localStorage.getItem('leo_guest_uid');
        if (!deviceUid) {
          deviceUid = uuidv4();
          localStorage.setItem('leo_guest_uid', deviceUid);
        }

        const res = await fetch('/api/guest/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_session_id: deviceUid,
            pigName: pigName.trim(),
          }),
        });

        if (!res.ok) {
          const { error: apiError } = await res.json();
          setError(apiError || 'Failed to save pig name');
          setIsSubmitting(false);
          return;
        }

        const data = await res.json();

        // CRITICAL: Sync localStorage with server's session ID
        // The server uses __Host-leo_sid cookie, but client-side code reads leo_guest_uid
        // Extract UUID from pigId (format: sid_XXXXXXXX)
        const serverUuid = data.pigId.replace('sid_', '');
        localStorage.setItem('leo_guest_uid', serverUuid);
        localStorage.setItem('guestSessionId', serverUuid); // Legacy key
        localStorage.setItem('leo_pig_name_local', pigName.trim());

        console.log('[Name] Guest pig created:', pigName.trim(), 'synced UUID:', serverUuid);
        
        // Show confetti celebration
        playChimeSound();
        setShowConfetti(true);
        console.log('[Name] ✨ Starting guest confetti animation');
        setTimeout(() => {
          setShowConfetti(false);
          // Show 5s settle screen
          setShowSettle(true);
          console.log('[Name] 🎯 Guest settle screen should now be visible (showSettle=true)');
          setTimeout(() => {
            // Use the correct pigId format for the reflect route
            const guestPigId = `sid_${serverUuid}`;
            console.log('[Name] ➡️ Redirecting guest to /reflect/', guestPigId);
            // Redirect to guest flow
            router.push(`/reflect/${guestPigId}`);
          }, 5000);
        }, 2000);
      }
    } catch (err) {
      console.error('[Name] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Show settle screen after naming
  if (showSettle) {
    console.log('[Name] 🌟 Rendering settle screen for:', pigName);
    return (
      <section 
        className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden px-6"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Calm gradient */}
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

        {/* Animated Pig - floats up with wing flutter */}
        <motion.div
          className="mb-8"
          initial={{ y: 100, opacity: 0 }}
          animate={{ 
            y: [100, -5, -10, -8, -10], 
            opacity: 1,
            rotate: [0, 2, -2, 1, -1, 0],
          }}
          transition={{ 
            y: { 
              duration: 3,
              ease: [0.34, 1.56, 0.64, 1],
              times: [0, 0.4, 0.6, 0.8, 1]
            },
            opacity: { duration: 0.8 },
            rotate: {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1.5
            }
          }}
        >
          <PinkPig size={180} state="idle" />
        </motion.div>

        {/* Settle text - uniform styling */}
        <motion.div
          className="text-center space-y-4 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
        >
          <motion.p
            className="text-pink-800 text-base md:text-lg font-serif italic leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            So it's settled.
          </motion.p>
          
          <motion.p
            className="text-pink-800 text-base md:text-lg font-serif italic leading-relaxed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 1.2 }}
          >
            I am <span className="font-bold">{pigName}</span>.
          </motion.p>

          <motion.p
            className="text-pink-800 text-base md:text-lg font-serif italic leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 1 }}
          >
            I'll remember that… wherever you find me again
          </motion.p>
        </motion.div>

        {/* Subtle progress indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 3, duration: 0.5 }}
        >
          <div className="w-32 h-1 bg-pink-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-pink-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </div>
        </motion.div>
      </section>
    );
  }

  // Show loading while checking for existing pig
  if (isCheckingExisting) {
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-pink-800 text-lg font-serif italic">Loading...</div>
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

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-center space-y-3 py-8">
        
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
          className="flex flex-col gap-2 items-center text-center px-6 max-w-md -mt-4"
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
              Yet here I am;
            </motion.p>
          )}

          {showLine3 && (
            <motion.p
              className="text-pink-800 text-base font-serif italic"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Waiting for someone to believe I could.
            </motion.p>
          )}

          {showLine4 && (
            <motion.p
              className="text-pink-800 text-base font-serif italic mt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              I don't have a name yet.
            </motion.p>
          )}

          {showLine5 && (
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

            {/* Submit button - single "Name Me" button */}
            <motion.button
              type="submit"
              disabled={!pigName.trim() || isSubmitting}
              onClick={() => playClickSound()}
              className="w-full max-w-sm py-3 px-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSubmitting ? 'Saving...' : 'Name Me'}
            </motion.button>

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
      </div>
    </section>
  );
}

/**
 * /start - Universal QR Entry Point
 * 
 * Single URL for all users (QR codes point here)
 * Device-aware routing with localStorage hints
 * 
 * Boot logic:
 * 1. Signed in → redirect to /app
 * 2. Has local pig name → redirect to /signin?prefillPig=1 (same device fast-path)
 * 3. Fresh → show Name Pig + Fetch My Pig options
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import PinkPig from '@/components/molecules/PinkPig';

export default function StartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for session to load
    if (status === 'loading') return;

    // 1. If signed in → go to app
    if (session?.user) {
      console.log('[Start] User signed in, redirecting to /app');
      router.replace('/app');
      return;
    }

    // 2. Check localStorage for previous pig on this device
    const localPigName = localStorage.getItem('leo_pig_name_local');
    if (localPigName) {
      console.log('[Start] Found local pig, fast-path to sign-in');
      router.replace('/signin?prefillPig=1');
      return;
    }

    // 3. Fresh device → show landing
    console.log('[Start] Fresh device, showing landing');
    setIsChecking(false);
  }, [session, status, router]);

  // Loading state while checking
  if (isChecking) {
    return (
      <section 
        className="relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden"
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
        >
          <PinkPig 
            size={240} 
            state="idle"
          />
        </motion.div>
      </section>
    );
  }

  // Fresh device landing - redirect to naming flow
  // (We'll create a dedicated /landing or /name component)
  router.replace('/name');
  return null;
}

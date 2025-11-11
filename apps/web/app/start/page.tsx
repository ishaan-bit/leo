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
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-8xl"
        >
          🐷
        </motion.div>
      </main>
    );
  }

  // Fresh device landing - redirect to naming flow
  // (We'll create a dedicated /landing or /name component)
  router.replace('/name');
  return null;
}

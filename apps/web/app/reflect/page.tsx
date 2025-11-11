'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReflectRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      try {
        // Fetch effective identity
        const res = await fetch('/api/effective');
        if (!res.ok) {
          // Default to guest flow if can't determine identity
          router.push('/guest/name-pig');
          return;
        }

        const identity = await res.json();
        
        if (!identity.pigName) {
          // Redirect to appropriate naming flow based on auth status
          if (identity.mode === 'auth') {
            router.push('/name'); // Authenticated but no pig name
          } else {
            router.push('/guest/name-pig'); // Guest without pig name
          }
          return;
        }

        // Redirect to City Interlude with pigId
        router.push(`/reflect/${identity.pigId || identity.pigName}`);
      } catch (err) {
        console.error('[Reflect] Error:', err);
        router.push('/guest/name-pig'); // Default to guest on error
      }
    }

    redirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-rose-50 flex items-center justify-center">
      <div className="text-pink-800 text-lg font-serif italic">
        Finding your way...
      </div>
    </div>
  );
}

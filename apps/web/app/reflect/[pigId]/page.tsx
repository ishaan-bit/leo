'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReflectPageProps {
  params: { pigId: string };
}

/**
 * Legacy reflect page - redirects to awakening scene
 * This route is deprecated in favor of the new awakening ritual
 */
export default function ReflectPage({ params }: ReflectPageProps) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to awakening scene
    router.replace('/awakening');
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-peach-100 to-purple-100 px-6">
      <p className="text-pink-700/60 animate-pulse">Redirecting to awakening...</p>
    </main>
  );
}

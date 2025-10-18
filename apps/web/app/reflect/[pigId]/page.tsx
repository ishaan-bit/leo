'use client';

import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReflectPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const pigId = params.pigId as string;
  const [pigName, setPigName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPigName() {
      try {
        const response = await fetch(`/api/pig/${pigId}/name`);
        if (response.ok) {
          const data = await response.json();
          setPigName(data.name);
        }
      } catch (error) {
        console.error('Failed to fetch pig name:', error);
      } finally {
        setLoading(false);
      }
    }

    if (pigId) {
      fetchPigName();
    }
  }, [pigId]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-800 text-lg font-serif italic">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8 text-center">
        {/* Pig Name Display */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif text-pink-900">
            {pigName || 'Your Pig'}
          </h1>
          
          {/* Authentication Status */}
          <div className="py-6 px-8 bg-white/50 rounded-lg border border-pink-200">
            {session ? (
              <div className="space-y-2">
                <p className="text-lg font-serif italic text-pink-800">
                  Signed in as
                </p>
                <p className="text-xl font-medium text-pink-900">
                  {session.user?.email || session.user?.name || 'User'}
                </p>
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-16 h-16 rounded-full mx-auto mt-4 border-2 border-pink-300"
                  />
                )}
              </div>
            ) : (
              <p className="text-lg font-serif italic text-pink-800">
                Continuing as Guest
              </p>
            )}
          </div>
        </div>

        {/* Placeholder for future content */}
        <div className="pt-8 space-y-4">
          <p className="text-base font-serif italic text-pink-700">
            This is where your journey continues...
          </p>
        </div>
      </div>
    </div>
  );
}

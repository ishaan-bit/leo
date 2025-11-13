'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Scene_Reflect from '@/components/scenes/Scene_Reflect';

export default function ReflectPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const pigId = params.pigId as string;
  const [pigName, setPigName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function validateAndFetchPigName() {
      try {
        // CRITICAL FIX: For guest sessions, verify pigId matches current localStorage session
        if (status === 'unauthenticated' && pigId?.startsWith('sid_')) {
          const currentSid = localStorage.getItem('guestSessionId');
          const expectedPigId = currentSid ? `sid_${currentSid}` : null;
          
          console.log('[ReflectPage] Guest session validation:', {
            urlPigId: pigId,
            currentSid,
            expectedPigId,
            matches: pigId === expectedPigId
          });
          
          // If URL pigId doesn't match current session, redirect to correct one
          if (expectedPigId && pigId !== expectedPigId) {
            console.warn('[ReflectPage] ⚠️ URL pigId mismatch! Redirecting to current session:', expectedPigId);
            router.replace(`/reflect/${expectedPigId}`);
            return; // Don't fetch old pig name
          }
          
          // If no current session but URL has pigId, restore session from URL
          // This handles cases like: shared links, bookmarks, localStorage cleared, etc.
          if (!currentSid && pigId.startsWith('sid_')) {
            const sessionIdFromUrl = pigId.replace('sid_', '');
            console.log('[ReflectPage] 🔄 No localStorage session found. Restoring from URL:', sessionIdFromUrl);
            localStorage.setItem('guestSessionId', sessionIdFromUrl);
            // Continue to fetch pig name - session is now restored
          }
        }
        
        // Fetch pig name for the validated pigId
        const response = await fetch(`/api/pig/${pigId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.name) {
            setPigName(data.name);
          } else {
            setPigName(null);
          }
        } else {
          setPigName(null);
        }
      } catch (error) {
        console.error('Failed to fetch pig name:', error);
        setPigName(null);
      } finally {
        setLoading(false);
      }
    }

    if (pigId && status !== 'loading') {
      validateAndFetchPigName();
    }
  }, [pigId, status, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-800 text-lg font-serif italic">Loading...</div>
      </div>
    );
  }

  if (!pigName) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-pink-800 text-lg font-serif italic">
            Could not load your companion...
          </p>
          <a 
            href={`/p/${pigId}`}
            className="text-pink-600 hover:text-pink-800 underline text-sm"
          >
            Start from the beginning
          </a>
        </div>
      </div>
    );
  }

  return <Scene_Reflect pigId={pigId} pigName={pigName} />;
}

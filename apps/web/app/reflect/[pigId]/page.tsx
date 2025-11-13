'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Scene_Reflect from '@/components/scenes/Scene_Reflect';
import { loadGuestSession, restoreFromUrl, validatePigId } from '@/lib/guest-session';

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
        // CRITICAL FIX: For guest sessions, use centralized session management
        if (status === 'unauthenticated' && pigId?.startsWith('sid_')) {
          const existingSession = loadGuestSession();
          
          console.log('[ReflectPage] Guest session validation:', {
            urlPigId: pigId,
            hasExistingSession: !!existingSession,
            existingPigId: existingSession?.pigId || null,
            matches: existingSession?.pigId === pigId,
          });
          
          // If localStorage has a session, validate it matches URL
          if (existingSession) {
            if (existingSession.pigId !== pigId) {
              console.warn('[ReflectPage] ⚠️ URL pigId mismatch! Redirecting to current session:', existingSession.pigId);
              router.replace(`/reflect/${existingSession.pigId}`);
              return;
            }
            // Session matches - continue
          } else {
            // No localStorage session - restore from URL (one-time only)
            console.log('[ReflectPage] 🔄 No localStorage session, attempting URL restore');
            const restored = restoreFromUrl(pigId);
            
            if (!restored) {
              console.error('[ReflectPage] ❌ URL restore failed');
              router.replace('/start');
              return;
            }
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

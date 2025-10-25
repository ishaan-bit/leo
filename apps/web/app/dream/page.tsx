/**
 * Dream Player Page - Cinematic render of city with 3-8 moments
 * Ghibli-style City of Living Moments
 */

'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { PendingDream } from '@/domain/dream/dream.types';
import DreamScene from '@/components/scenes/Scene_Dream';
import DreamControls from '@/components/organisms/DreamControls';

function DreamPlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scriptId = searchParams?.get('sid');
  const testMode = searchParams?.get('testMode') === '1';
  
  const [dream, setDream] = useState<PendingDream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Fetch dream on mount
  useEffect(() => {
    if (!scriptId) {
      setError('No script ID provided');
      setLoading(false);
      return;
    }

    fetch(`/api/dream/fetch?sid=${scriptId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setDream(data.dream);
          setIsPlaying(true);
          startTimeRef.current = performance.now();
          
          // Telemetry: dream_play_start
          console.log('[telemetry] dream_play_start', {
            scriptId: data.dream.scriptId,
            kind: data.dream.kind,
            K: data.dream.usedMomentIds.length,
            test: testMode,
            timestamp: new Date().toISOString(),
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch dream:', err);
        setError('Failed to load dream');
        setLoading(false);
      });
  }, [scriptId]);

  // Animation loop for playback time
  useEffect(() => {
    if (!isPlaying || !dream || isPaused) return;

    const updateTime = () => {
      const elapsed = (performance.now() - startTimeRef.current - pausedTimeRef.current) / 1000;
      setCurrentTime(elapsed);

      if (elapsed >= dream.duration) {
        // Dream complete
        handleComplete();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isPaused, dream]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime]);

  const handleComplete = async () => {
    if (!dream) return;

    setIsPlaying(false);

    // Telemetry: dream_complete
    console.log('[telemetry] dream_complete', {
      scriptId: dream.scriptId,
      K: dream.usedMomentIds.length,
      test: testMode,
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch('/api/dream/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: dream.scriptId,
          skipped: false,
        }),
      });

      const data = await res.json();
      if (data.redirectTo) {
        router.push(data.redirectTo);
      }
    } catch (error) {
      console.error('Failed to complete dream:', error);
      router.push('/reflect/new');
    }
  };

  const handleSkip = async () => {
    if (!dream) return;

    setIsPlaying(false);

    // Telemetry: dream_skipped
    console.log('[telemetry] dream_skipped', {
      scriptId: dream.scriptId,
      skipTime: currentTime,
      test: testMode,
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch('/api/dream/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: dream.scriptId,
          skipped: true,
          skipTime: currentTime,
        }),
      });

      const data = await res.json();
      if (data.redirectTo) {
        router.push(data.redirectTo);
      }
    } catch (error) {
      console.error('Failed to skip dream:', error);
      router.push('/reflect/new');
    }
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume
      pausedTimeRef.current += performance.now() - pausedTimeRef.current;
      setIsPaused(false);
    } else {
      // Pause
      pausedTimeRef.current = performance.now();
      setIsPaused(true);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#E4E8F6] to-[#C8CFE6]">
        <motion.div
          className="text-xl text-[#2D2A54]"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          The city awakens...
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error || !dream) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#E4E8F6] to-[#C8CFE6] p-6">
        <div className="text-center">
          <h1
            className="text-2xl mb-4 text-[#2D2A54]"
            style={{ fontFamily: '"Cormorant Garamond", serif' }}
          >
            {error || 'Dream not found'}
          </h1>
          <button
            onClick={() => router.push('/reflect/new')}
            className="px-6 py-3 rounded-xl bg-white/80 hover:bg-white transition-colors text-[#2D2A54]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Continue to Reflect
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dream Scene */}
      <DreamScene
        dream={dream}
        currentTime={currentTime}
        isPaused={isPaused}
      />

      {/* Controls */}
      <DreamControls
        onSkip={handleSkip}
        onPause={togglePause}
        isPaused={isPaused}
        currentTime={currentTime}
        duration={dream.duration}
      />

      {/* TEST MODE Badge */}
      {testMode && (
        <div className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg bg-yellow-500/90 text-black text-xs font-bold shadow-lg backdrop-blur-sm">
          TEST MODE: force_dream
        </div>
      )}
    </>
  );
}

export default function DreamPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#E4E8F6] to-[#C8CFE6]">
        <div className="text-xl text-[#2D2A54]" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Loading...
        </div>
      </div>
    }>
      <DreamPlayerContent />
    </Suspense>
  );
}

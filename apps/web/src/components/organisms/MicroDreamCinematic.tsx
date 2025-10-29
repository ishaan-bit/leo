'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PinkPig from '../molecules/PinkPig';
import TopNav from '../molecules/TopNav';

// Dreamscape timing - slowed down for gentle, contemplative experience
const timings = {
  entrance: { fadeIn: 1500, sceneEaseIn: 2200, pigDelay: 1000 },
  lines: { l1FadeIn: 1800, l1Delay: 2800, l2FadeIn: 1300, l2Delay: 5000, pulseDuration: 4000 },
  snippet: { fadeIn: 800, hold: 2800, fadeOut: 800, overlap: 300 },
  ambient: { start: 6000, end: 17000 },
  waking: { start: 17000, duration: 3000, textDelay: 1000 },
  exit: { morphToPink: 2500, dissolve: 1500, finalFade: 1000 },
};

type PrimaryEmotion = 'sad' | 'joyful' | 'powerful' | 'mad' | 'peaceful' | 'scared';

interface MicroDream {
  lines: string[];
  fades?: string[];
  dominant_primary?: PrimaryEmotion;
  valence_mean?: number;
  arousal_mean?: number;
  createdAt?: string;
  algo?: string;
}

interface Props {
  dream: MicroDream;
  pigName?: string;
  onComplete?: () => void;
}

const emotionThemes: Record<PrimaryEmotion, { hue: number; blueBoost: number; grain: number }> = {
  scared: { hue: -10, blueBoost: 0.05, grain: 0.05 },
  joyful: { hue: 8, blueBoost: -0.03, grain: -0.05 },
  sad: { hue: -12, blueBoost: 0.08, grain: 0 },
  powerful: { hue: 6, blueBoost: -0.02, grain: 0.03 },
  mad: { hue: -15, blueBoost: 0.02, grain: 0.08 },
  peaceful: { hue: 4, blueBoost: -0.05, grain: -0.03 },
};

export default function MicroDreamCinematic({ dream, pigName = 'Your Pig', onComplete }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<'entering' | 'ambient' | 'waking' | 'exiting'>('entering');
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showWakingText, setShowWakingText] = useState(false);
  const [snippets, setSnippets] = useState<Array<{ id: string; text: string }>>([]);
  const [currentSnippetIndex, setCurrentSnippetIndex] = useState(0);
  const [rgbIntensity, setRgbIntensity] = useState(0.25);
  const [showPinkMorph, setShowPinkMorph] = useState(false);
  
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const line1 = dream.lines[0] || 'A quiet pause found me.';
  const line2 = dream.lines[1] || 'Take a gentle breath.';
  const theme = dream.dominant_primary ? emotionThemes[dream.dominant_primary] : emotionThemes.peaceful;

  // Fetch snippets from fades
  useEffect(() => {
    if (!dream.fades?.length) return;
    
    const sampled = dream.fades.length <= 6 ? dream.fades : dream.fades.sort(() => 0.5 - Math.random()).slice(0, 6);
    
    Promise.all(sampled.map(async (id) => {
      try {
        const res = await fetch(`/api/reflect/${id}`);
        if (res.ok) {
          const data = await res.json();
          const text = (data.normalized_text || data.raw_text || `#${id.slice(-8)}`)
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
            .replace(/https?:\/\/[^\s]+/g, '')
            .trim()
            .split(/[.!?]/)[0]
            .slice(0, 100);
          return { id, text };
        }
      } catch (e) { }
      return { id, text: `#${id.slice(-8)}` };
    })).then(setSnippets);
  }, [dream.fades]);

  // Line 1 fade-in (no typewriter)
  useEffect(() => {
    const t = setTimeout(() => setShowLine1(true), timings.lines.l1Delay);
    return () => clearTimeout(t);
  }, []);

  // L2 fade-in
  useEffect(() => {
    const t = setTimeout(() => setShowLine2(true), timings.lines.l2Delay);
    return () => clearTimeout(t);
  }, []);

  // RGB ramp-up
  useEffect(() => {
    const t = setTimeout(() => setRgbIntensity(0.7), timings.entrance.sceneEaseIn);
    return () => clearTimeout(t);
  }, []);

  // Ambient phase start
  useEffect(() => {
    const t = setTimeout(() => setPhase('ambient'), timings.ambient.start);
    return () => clearTimeout(t);
  }, []);

  // Snippet carousel
  useEffect(() => {
    if (phase !== 'ambient' || !snippets.length) return;
    const duration = timings.snippet.fadeIn + timings.snippet.hold + timings.snippet.fadeOut - timings.snippet.overlap;
    const iv = setInterval(() => {
      setCurrentSnippetIndex(prev => {
        const next = (prev + 1) % snippets.length;
        console.log('[Telemetry] micro_dream.snippet_show', { id: snippets[next]?.id, index: next, chars: snippets[next]?.text.length });
        return next;
      });
    }, duration);
    return () => clearInterval(iv);
  }, [phase, snippets]);

  // Waking transition
  useEffect(() => {
    const t = setTimeout(() => setPhase('waking'), timings.ambient.end);
    return () => clearTimeout(t);
  }, []);

  // Exit sequence - RPG-style immersive transition
  useEffect(() => {
    if (phase !== 'waking') return;
    
    // Show waking text first
    const t1 = setTimeout(() => setShowWakingText(true), timings.waking.textDelay);
    
    // Then morph to pink
    const t2 = setTimeout(() => setShowPinkMorph(true), timings.waking.textDelay + 400);
    
    // Finally transition to write page
    const t3 = setTimeout(() => {
      setPhase('exiting');
      setTimeout(() => {
        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));
      }, timings.exit.finalFade);
    }, timings.waking.duration);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase, onComplete, router]);

  // Keyboard
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        console.log('[Telemetry] micro_dream.advance_user');
        setPhase('waking');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        console.log('[Telemetry] micro_dream.skip');
        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onComplete, router]);

  // Telemetry
  useEffect(() => {
    console.log('[Telemetry] micro_dream.view', {
      algo: dream.algo,
      dominant_primary: dream.dominant_primary,
      valence_mean: dream.valence_mean,
      arousal_mean: dream.arousal_mean,
    });
    return () => {
      if (phase === 'exiting') console.log('[Telemetry] micro_dream.complete');
    };
  }, [phase, dream]);

  const currentSnippet = snippets[currentSnippetIndex];

  return (
    <div className="fixed inset-0 overflow-hidden" onClick={() => { setPhase('waking'); }}>
      {/* Add handwritten font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Kalam:wght@300;400;700&display=swap');
      `}</style>

      {/* Night sky -> Pink morph (seamless Ghibli-style transition) */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: showPinkMorph
            ? 'linear-gradient(135deg, #ffc9e0 0%, #ffe4f0 50%, #fff5f9 100%)'
            : 'linear-gradient(135deg, #0a0030, #18003a, #001a2a)',
        }}
        transition={{ duration: timings.exit.morphToPink / 1000, ease: 'easeInOut' }}
      />

      {/* RGB Glows - more vibrant RGB style (cyan/magenta/yellow) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: showPinkMorph ? 0 : rgbIntensity }}
        transition={{ duration: timings.entrance.sceneEaseIn / 1000 }}
      >
        <div className="absolute mix-blend-screen" style={{
          left: '25%', top: '65%', width: '60vmax', height: '60vmax',
          background: `radial-gradient(circle, rgba(255, 0, 128, 0.45) 0%, transparent 70%)`,
          filter: 'blur(100px)', transform: 'translate(-50%, -50%)',
        }} />
        <div className="absolute mix-blend-screen" style={{
          right: '20%', top: '30%', width: '50vmax', height: '50vmax',
          background: `radial-gradient(circle, rgba(0, 255, 200, 0.40) 0%, transparent 70%)`,
          filter: 'blur(100px)', transform: 'translate(50%, -50%)',
        }} />
        <div className="absolute mix-blend-screen" style={{
          left: '50%', bottom: '0', width: '70vmax', height: '70vmax',
          background: `radial-gradient(circle, rgba(100, 150, 255, 0.42) 0%, transparent 70%)`,
          filter: 'blur(120px)', transform: 'translate(-50%, 50%)',
        }} />
      </motion.div>

      {/* Stars - fade out during exit */}
      <AnimatePresence>
        {!showPinkMorph && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: timings.exit.morphToPink / 1000 }}
            className="absolute inset-0 pointer-events-none"
          >
            {Array.from({ length: 60 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white/70 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 60}%`,
                }}
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comic skyline silhouettes - fade out smoothly during exit */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-32 z-[5]"
            animate={{ opacity: showPinkMorph ? 0 : 1 }}
            transition={{ duration: timings.exit.morphToPink / 1000, ease: 'easeOut' }}
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,80 L50,80 L50,40 L100,40 L100,80 L200,80 L200,20 L250,20 L250,80 L400,80 L400,50 L450,50 L450,80 L600,80 L600,30 L650,30 L650,80 L800,80 L800,60 L850,60 L850,80 L1000,80 L1000,45 L1050,45 L1050,80 L1200,80 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.08)\' /%3E%3C/svg%3E")',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-24 opacity-60 z-[5]"
            animate={{ opacity: showPinkMorph ? 0 : 0.6 }}
            transition={{ duration: timings.exit.morphToPink / 1000, ease: 'easeOut' }}
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,90 L100,90 L100,70 L150,70 L150,90 L300,90 L300,60 L350,60 L350,90 L500,90 L500,75 L550,75 L550,90 L700,90 L700,65 L750,65 L750,90 L900,90 L900,80 L950,80 L950,90 L1200,90 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.05)\' /%3E%3C/svg%3E")',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </>
      )}

      {/* Clouds removed - was causing text blur */}

      {/* Top navigation - horizontally aligned */}
      <TopNav
        centerElement={
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <span className="text-xs md:text-sm text-pink-900/80">
              {status === 'unauthenticated' ? 'Guest mode 🌸' : (session?.user?.name)}
            </span>
          </motion.div>
        }
      />

      {/* Pig (floating, centered higher - will transition to moment page position) */}
      <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: '12%' }}>
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{
            opacity: phase === 'exiting' ? 0 : 0.92,
            scale: phase === 'exiting' 
              ? 0.7 
              : (prefersReducedMotion ? 1 : [0.95, 1.05, 0.95]),
            y: phase === 'exiting'
              ? 60
              : (prefersReducedMotion ? 0 : [0, -8, 0]),
          }}
          transition={{
            opacity: phase === 'exiting' 
              ? { duration: timings.exit.finalFade / 1000, ease: 'easeInOut' }
              : { duration: timings.entrance.sceneEaseIn / 1000, delay: timings.entrance.pigDelay / 1000 },
            scale: phase === 'exiting'
              ? { duration: timings.exit.finalFade / 1000, ease: 'easeInOut' }
              : { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            y: phase === 'exiting'
              ? { duration: timings.exit.finalFade / 1000, ease: 'easeOut' }
              : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <PinkPig size={160} className="filter drop-shadow-[0_0_35px_rgba(255,100,180,0.45)]" />
        </motion.div>
      </div>

      {/* Text cluster - below pig, smooth transition */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 md:px-12 z-15 pointer-events-none" style={{ top: '10%' }}>
        <motion.div
          className="max-w-4xl text-center space-y-6"
          animate={phase === 'exiting' ? { opacity: 0, y: 30, filter: 'blur(3px)' } : {}}
          transition={{ duration: timings.exit.dissolve / 1000, ease: 'easeOut' }}
        >
          {/* L1 - handwritten style with RGB glow, fades down smoothly */}
          <AnimatePresence>
            {showLine1 && (
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: phase === 'waking' || phase === 'exiting' ? 0 : 1,
                  y: phase === 'exiting' ? 20 : 0,
                }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ 
                  duration: phase === 'exiting' ? timings.exit.dissolve / 1000 : timings.lines.l1FadeIn / 1000,
                  ease: 'easeOut' 
                }}
                className="text-5xl md:text-7xl lg:text-8xl leading-tight tracking-wide"
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontWeight: 700,
                  color: '#00ffcc',
                  textShadow: `
                    0 0 30px rgba(0, 255, 204, 0.6),
                    0 0 60px rgba(255, 0, 128, 0.4),
                    2px 2px 8px rgba(100, 150, 255, 0.3),
                    0 0 100px rgba(0, 255, 204, 0.2)
                  `,
                }}
              >
                {line1}
              </motion.h1>
            )}
          </AnimatePresence>

          {/* L2 - softer handwritten, fades down smoothly */}
          <AnimatePresence>
            {showLine2 && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ 
                  opacity: phase === 'waking' || phase === 'exiting' ? 0 : 0.9,
                  y: phase === 'exiting' ? 15 : 0,
                }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ 
                  duration: phase === 'exiting' ? timings.exit.dissolve / 1000 : timings.lines.l2FadeIn / 1000,
                  ease: 'easeOut' 
                }}
                className="text-2xl md:text-3xl"
                style={{
                  fontFamily: "'Kalam', cursive",
                  fontWeight: 400,
                  color: '#ff69d4',
                  textShadow: '0 0 20px rgba(255, 105, 212, 0.5), 0 0 40px rgba(0, 255, 200, 0.3)',
                }}
              >
                {line2}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Snippet carousel - no "from earlier" label */}
          {phase === 'ambient' && currentSnippet && (
            <div className="mt-8 h-16 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSnippet.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.75, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{
                    opacity: { duration: timings.snippet.fadeIn / 1000 },
                    y: { duration: timings.snippet.fadeIn / 1000 },
                  }}
                  className="text-lg md:text-xl italic max-w-[50ch] text-center"
                  style={{
                    fontFamily: "'Kalam', cursive",
                    color: '#c4b5fd',
                    textShadow: `
                      0 0 15px rgba(196, 181, 253, 0.4),
                      0 0 30px rgba(147, 197, 253, 0.3)
                    `,
                  }}
                >
                  {currentSnippet.text}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Waking up text - appears during transition, moves down */}
          <AnimatePresence>
            {showWakingText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: 1,
                  y: phase === 'exiting' ? 25 : 0,
                }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ 
                  duration: phase === 'exiting' ? timings.exit.finalFade / 1000 : 1,
                  ease: 'easeOut' 
                }}
                className="mt-12 text-2xl md:text-3xl"
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontWeight: 600,
                  color: showPinkMorph ? '#db2777' : '#fbbf24',
                  textShadow: showPinkMorph 
                    ? '0 0 20px rgba(219, 39, 119, 0.6)' 
                    : '0 0 30px rgba(251, 191, 36, 0.7), 0 0 60px rgba(251, 191, 36, 0.4)',
                }}
              >
                {pigName} is waking up...
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer - centered pig name + dreamscape label, fades down during exit */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: (phase === 'waking' || phase === 'exiting') ? 0 : [0.8, 1, 0.8],
            y: phase === 'exiting' ? 20 : 0,
            scale: (phase === 'waking' || phase === 'exiting') ? 0.95 : [1, 1.02, 1],
          }}
          transition={{
            opacity: (phase === 'waking' || phase === 'exiting')
              ? { duration: 0.8, ease: 'easeOut' } 
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: phase === 'exiting' ? 0.8 : 0.6, delay: phase === 'exiting' ? 0 : 0.4, ease: 'easeOut' },
            scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="px-6 py-2 text-sm tracking-widest uppercase text-center"
          style={{
            fontFamily: "'Kalam', cursive",
            fontWeight: 300,
            color: '#a78bfa',
            textShadow: '0 0 15px rgba(167, 139, 250, 0.5), 0 0 30px rgba(167, 139, 250, 0.3)',
            filter: 'drop-shadow(0 0 20px rgba(167, 139, 250, 0.4))',
          }}
        >
          {pigName}'s dreamscape
        </motion.div>
      </div>

      {/* Entrance fade */}
      <AnimatePresence>
        {phase === 'entering' && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: timings.entrance.fadeIn / 1000 }}
            className="absolute inset-0 bg-black pointer-events-none z-30"
          />
        )}
      </AnimatePresence>

      {/* Screen reader */}
      <div className="sr-only" role="status" aria-live="polite">
        {showLine1 ? line1 : ''} {showLine2 ? line2 : ''}
        {showWakingText ? ` ${pigName} is waking up` : ''}
      </div>
      <a
        href="#skip"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:z-50"
        onClick={(e) => {
          e.preventDefault();
          onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));
        }}
      >
        Skip dream and start writing
      </a>
    </div>
  );
}

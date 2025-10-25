'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PinkPig from '../molecules/PinkPig';

// Timings for 12-15s experience
const timings = {
  entrance: { fadeIn: 700, sceneEaseIn: 1300 },
  lines: { charDelay: 22, charJitter: 5, bloomDuration: 500, l2FadeDelay: 500, ambientStart: 3400, ambientEnd: 12200 },
  snippet: { fadeIn: 450, hold: 1800, fadeOut: 450, overlap: 150 },
  exit: { wakingDuration: 1200, morphToPink: 1400, dissolve: 650, irisIn: 150 },
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
  const [phase, setPhase] = useState<'entering' | 'ambient' | 'waking' | 'exiting'>('entering');
  const [line1Text, setLine1Text] = useState('');
  const [showLine2, setShowLine2] = useState(false);
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

  // Type-on L1
  useEffect(() => {
    if (prefersReducedMotion) {
      setLine1Text(line1);
      return;
    }
    let i = 0;
    const iv = setInterval(() => {
      if (i < line1.length) setLine1Text(line1.slice(0, ++i));
      else clearInterval(iv);
    }, timings.lines.charDelay + Math.random() * timings.lines.charJitter);
    return () => clearInterval(iv);
  }, [line1, prefersReducedMotion]);

  // L2 fade-in
  useEffect(() => {
    const t = setTimeout(() => setShowLine2(true), timings.lines.l2FadeDelay);
    return () => clearTimeout(t);
  }, []);

  // RGB ramp-up
  useEffect(() => {
    const t = setTimeout(() => setRgbIntensity(0.7), timings.entrance.sceneEaseIn);
    return () => clearTimeout(t);
  }, []);

  // Ambient phase start
  useEffect(() => {
    const t = setTimeout(() => setPhase('ambient'), timings.lines.ambientStart);
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
    const t = setTimeout(() => setPhase('waking'), timings.lines.ambientEnd);
    return () => clearTimeout(t);
  }, []);

  // Exit sequence
  useEffect(() => {
    if (phase !== 'waking') return;
    setShowPinkMorph(true);
    const t = setTimeout(() => {
      setPhase('exiting');
      setTimeout(() => {
        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));
      }, timings.exit.irisIn + 250);
    }, timings.exit.wakingDuration);
    return () => clearTimeout(t);
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
      {/* Night sky → Pink morph */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: showPinkMorph
            ? 'linear-gradient(135deg, #ff6aa0, #ff8ec0, #ffd0e3)'
            : 'linear-gradient(135deg, #0a0030, #18003a, #001a2a)',
        }}
        transition={{ duration: timings.exit.morphToPink / 1000 }}
      />

      {/* RGB Glows */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: rgbIntensity }}
        transition={{ duration: timings.entrance.sceneEaseIn / 1000 }}
      >
        <div className="absolute mix-blend-screen" style={{
          left: '25%', top: '65%', width: '60vmax', height: '60vmax',
          background: `radial-gradient(circle, rgba(255, 70, 90, ${0.35 + theme.blueBoost * 0.3}) 0%, transparent 70%)`,
          filter: 'blur(100px)', transform: 'translate(-50%, -50%)',
        }} />
        <div className="absolute mix-blend-screen" style={{
          right: '20%', top: '30%', width: '50vmax', height: '50vmax',
          background: `radial-gradient(circle, rgba(60, 255, 170, ${0.30 - theme.blueBoost * 0.2}) 0%, transparent 70%)`,
          filter: 'blur(100px)', transform: 'translate(50%, -50%)',
        }} />
        <div className="absolute mix-blend-screen" style={{
          left: '50%', bottom: '0', width: '70vmax', height: '70vmax',
          background: `radial-gradient(circle, rgba(90, 150, 255, ${0.32 + theme.blueBoost}) 0%, transparent 70%)`,
          filter: 'blur(120px)', transform: 'translate(-50%, 50%)',
        }} />
      </motion.div>

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 bg-white/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      {/* Clouds */}
      {!prefersReducedMotion && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute h-20 rounded-full bg-white/5 backdrop-blur-sm"
              style={{
                top: `${15 + i * 12}%`,
                width: `${120 + i * 40}px`,
                left: `-${120 + i * 40}px`,
              }}
              animate={{ x: ['0vw', '110vw'] }}
              transition={{ duration: 35 + i * 15, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </>
      )}

      {/* Pig (breathing, idle float) */}
      <motion.div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: phase === 'exiting' ? 0 : 0.9,
          y: prefersReducedMotion ? 0 : [0, -6, 0],
        }}
        transition={{
          opacity: { duration: timings.entrance.sceneEaseIn / 1000 },
          y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <PinkPig size={180} className="filter drop-shadow-[0_0_40px_rgba(255,150,200,0.4)]" />
      </motion.div>

      {/* Comic skyline silhouettes (parallax) */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-32"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,80 L50,80 L50,40 L100,40 L100,80 L200,80 L200,20 L250,20 L250,80 L400,80 L400,50 L450,50 L450,80 L600,80 L600,30 L650,30 L650,80 L800,80 L800,60 L850,60 L850,80 L1000,80 L1000,45 L1050,45 L1050,80 L1200,80 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.08)\' /%3E%3C/svg%3E")',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
            animate={{ x: [0, -20, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-24 opacity-60"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,90 L100,90 L100,70 L150,70 L150,90 L300,90 L300,60 L350,60 L350,90 L500,90 L500,75 L550,75 L550,90 L700,90 L700,65 L750,65 L750,90 L900,90 L900,80 L950,80 L950,90 L1200,90 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.05)\' /%3E%3C/svg%3E")',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
            animate={{ x: [0, 15, 0] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* Lines + Snippet */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 md:px-12 z-10">
        <motion.div
          className="max-w-4xl text-center space-y-5"
          animate={phase === 'waking' || phase === 'exiting' ? { opacity: 0, filter: 'saturate(140%) blur(1.2px)' } : {}}
          transition={{ duration: timings.exit.dissolve / 1000 }}
        >
          {/* L1 */}
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-serif leading-tight tracking-wide text-white/95"
            style={{
              textShadow: `
                0 0 20px rgba(255, 255, 255, 0.3),
                2px 2px 6px rgba(255, 255, 255, 0.2),
                -1px -1px 4px rgba(255, 100, 100, 0.08),
                1px -1px 4px rgba(100, 255, 100, 0.08),
                -1px 1px 4px rgba(100, 100, 255, 0.08)
              `,
            }}
            animate={!prefersReducedMotion && line1Text === line1 ? { scale: [1, 1.015, 1] } : {}}
            transition={{ duration: timings.lines.bloomDuration / 1000 }}
          >
            {line1Text}
          </motion.h1>

          {/* L2 */}
          <AnimatePresence>
            {showLine2 && (
              <motion.p
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 0.85, y: 0 }}
                className="text-xl md:text-2xl text-white/85"
                style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.25)' }}
              >
                {line2}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Snippet carousel */}
          {phase === 'ambient' && currentSnippet && (
            <div className="mt-6 h-12 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSnippet.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: { duration: timings.snippet.fadeIn / 1000 },
                  }}
                  className="text-base md:text-lg text-white/80 italic max-w-[45ch] text-center"
                  style={{
                    textShadow: `
                      0 0 10px rgba(255, 200, 255, 0.2),
                      0 0 18px rgba(150, 150, 255, 0.18)
                    `,
                  }}
                >
                  <span className="text-white/50 text-sm not-italic">From earlier: </span>
                  {currentSnippet.text}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer pill */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="backdrop-blur-md bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-sm text-white/90 tracking-wide"
        >
          {phase === 'waking' || phase === 'exiting' ? `${pigName} is waking up…` : `${pigName}'s dreamscape`}
        </motion.div>
      </div>

      {/* Entrance fade */}
      <AnimatePresence>
        {phase === 'entering' && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: timings.entrance.fadeIn / 1000 }}
            className="absolute inset-0 bg-black pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {/* Exit iris */}
      <AnimatePresence>
        {phase === 'exiting' && (
          <motion.div
            initial={{ clipPath: 'circle(100% at 50% 50%)' }}
            animate={{ clipPath: 'circle(0% at 50% 50%)' }}
            transition={{ duration: timings.exit.irisIn / 1000, ease: 'easeIn' }}
            className="absolute inset-0 bg-white pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* Screen reader */}
      <div className="sr-only" role="status" aria-live="polite">
        {line1Text} {showLine2 ? line2 : ''}
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

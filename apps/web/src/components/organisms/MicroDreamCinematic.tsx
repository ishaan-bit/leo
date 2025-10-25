'use client';'use client';



import { useState, useEffect, useRef } from 'react';import { useState, useEffect } from 'react';

import { motion, AnimatePresence } from 'framer-motion';import { motion, AnimatePresence } from 'framer-motion';

import { useRouter } from 'next/navigation';import { useRouter } from 'next/navigation';

import PinkPig from '../molecules/PinkPig';import PinkPig from '../molecules/PinkPig';



// Dreamscape timing — 14s total// Timings for 12-15s experience

const timings = {const timings = {

  entrance: { skyFadeIn: 1000, pigFadeIn: 1000, pigDelay: 1000 },  entrance: { fadeIn: 700, sceneEaseIn: 1300 },

  lines: { l1FadeIn: 1000, l1Delay: 2000, l2FadeIn: 1000, l2Delay: 3000, pulseDuration: 6000 },  lines: { charDelay: 22, charJitter: 5, bloomDuration: 500, l2FadeDelay: 500, ambientStart: 3400, ambientEnd: 12200 },

  snippet: { fadeIn: 400, hold: 1700, fadeOut: 400 },  snippet: { fadeIn: 450, hold: 1800, fadeOut: 450, overlap: 150 },

  ambient: { start: 4000, end: 12000 },  exit: { wakingDuration: 1200, morphToPink: 1400, dissolve: 650, irisIn: 150 },

  waking: { start: 12000, duration: 1000 },};

  transition: { exposureFlash: 800, gradientMorph: 1400, fadeOut: 600 },

  complete: 14000,type PrimaryEmotion = 'sad' | 'joyful' | 'powerful' | 'mad' | 'peaceful' | 'scared';

};

interface MicroDream {

type PrimaryEmotion = 'sad' | 'joyful' | 'powerful' | 'mad' | 'peaceful' | 'scared';  lines: string[];

  fades?: string[];

interface MicroDream {  dominant_primary?: PrimaryEmotion;

  lines: string[];  valence_mean?: number;

  fades?: string[];  arousal_mean?: number;

  dominant_primary?: PrimaryEmotion;  createdAt?: string;

  valence_mean?: number;  algo?: string;

  arousal_mean?: number;}

  createdAt?: string;

  algo?: string;interface Props {

}  dream: MicroDream;

  pigName?: string;

interface ReflectionSnippet {  onComplete?: () => void;

  id: string;}

  text: string;

}const emotionThemes: Record<PrimaryEmotion, { hue: number; blueBoost: number; grain: number }> = {

  scared: { hue: -10, blueBoost: 0.05, grain: 0.05 },

interface Props {  joyful: { hue: 8, blueBoost: -0.03, grain: -0.05 },

  dream: MicroDream;  sad: { hue: -12, blueBoost: 0.08, grain: 0 },

  pigName?: string;  powerful: { hue: 6, blueBoost: -0.02, grain: 0.03 },

  onComplete?: () => void;  mad: { hue: -15, blueBoost: 0.02, grain: 0.08 },

}  peaceful: { hue: 4, blueBoost: -0.05, grain: -0.03 },

};

const emotionThemes: Record<PrimaryEmotion, { rgbShift: { r: number; g: number; b: number }; hueRotate: number }> = {

  scared: { rgbShift: { r: 0.28, g: 0.22, b: 0.35 }, hueRotate: -8 },export default function MicroDreamCinematic({ dream, pigName = 'Your Pig', onComplete }: Props) {

  joyful: { rgbShift: { r: 0.25, g: 0.30, b: 0.22 }, hueRotate: 5 },  const router = useRouter();

  sad: { rgbShift: { r: 0.22, g: 0.25, b: 0.32 }, hueRotate: -10 },  const [phase, setPhase] = useState<'entering' | 'ambient' | 'waking' | 'exiting'>('entering');

  powerful: { rgbShift: { r: 0.30, g: 0.26, b: 0.25 }, hueRotate: 3 },  const [line1Text, setLine1Text] = useState('');

  mad: { rgbShift: { r: 0.32, g: 0.20, b: 0.24 }, hueRotate: -12 },  const [showLine2, setShowLine2] = useState(false);

  peaceful: { rgbShift: { r: 0.24, g: 0.28, b: 0.30 }, hueRotate: 6 },  const [snippets, setSnippets] = useState<Array<{ id: string; text: string }>>([]);

};  const [currentSnippetIndex, setCurrentSnippetIndex] = useState(0);

  const [rgbIntensity, setRgbIntensity] = useState(0.25);

export default function MicroDreamCinematic({ dream, pigName = 'Your Pig', onComplete }: Props) {  const [showPinkMorph, setShowPinkMorph] = useState(false);

  const router = useRouter();  

  const [phase, setPhase] = useState<'entering' | 'ambient' | 'waking' | 'transitioning' | 'exiting'>('entering');  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [showLine1, setShowLine1] = useState(false);  const line1 = dream.lines[0] || 'A quiet pause found me.';

  const [showLine2, setShowLine2] = useState(false);  const line2 = dream.lines[1] || 'Take a gentle breath.';

  const [snippets, setSnippets] = useState<ReflectionSnippet[]>([]);  const theme = dream.dominant_primary ? emotionThemes[dream.dominant_primary] : emotionThemes.peaceful;

  const [currentSnippetIndex, setCurrentSnippetIndex] = useState(0);

  const [rgbPulse, setRgbPulse] = useState(1.0);  // Fetch snippets from fades

  const [showExposureFlash, setShowExposureFlash] = useState(false);  useEffect(() => {

  const [skyMorph, setSkyMorph] = useState(0); // 0 = night, 1 = pink    if (!dream.fades?.length) return;

  const startTimeRef = useRef<number>(Date.now());    

    const sampled = dream.fades.length <= 6 ? dream.fades : dream.fades.sort(() => 0.5 - Math.random()).slice(0, 6);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;    

  const line1 = dream.lines[0] || 'A quiet pause found me.';    Promise.all(sampled.map(async (id) => {

  const line2 = dream.lines[1] || 'Take a gentle breath.';      try {

  const theme = dream.dominant_primary ? emotionThemes[dream.dominant_primary] : emotionThemes.peaceful;        const res = await fetch(`/api/reflect/${id}`);

        if (res.ok) {

  // Fetch reflection snippets          const data = await res.json();

  useEffect(() => {          const text = (data.normalized_text || data.raw_text || `#${id.slice(-8)}`)

    if (!dream.fades?.length) return;            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')

            .replace(/https?:\/\/[^\s]+/g, '')

    const sampled = dream.fades.length <= 5 ? dream.fades : dream.fades.sort(() => 0.5 - Math.random()).slice(0, 5);            .trim()

            .split(/[.!?]/)[0]

    Promise.all(            .slice(0, 100);

      sampled.map(async (id) => {          return { id, text };

        try {        }

          const res = await fetch(`/api/reflect/${id}`);      } catch (e) { }

          if (res.ok) {      return { id, text: `#${id.slice(-8)}` };

            const data = await res.json();    })).then(setSnippets);

            const text = (data.normalized_text || data.raw_text || `Reflection #${id.slice(-8)}`)  }, [dream.fades]);

              .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')

              .replace(/https?:\/\/[^\s]+/g, '')  // Type-on L1

              .trim()  useEffect(() => {

              .split(/[.!?]/)[0]    if (prefersReducedMotion) {

              .slice(0, 100);      setLine1Text(line1);

            return { id, text };      return;

          }    }

        } catch (e) {    let i = 0;

          console.warn('[MicroDream] Failed to fetch snippet:', id);    const iv = setInterval(() => {

        }      if (i < line1.length) setLine1Text(line1.slice(0, ++i));

        return { id, text: `Reflection #${id.slice(-8)}` };      else clearInterval(iv);

      })    }, timings.lines.charDelay + Math.random() * timings.lines.charJitter);

    ).then(setSnippets);    return () => clearInterval(iv);

  }, [dream.fades]);  }, [line1, prefersReducedMotion]);



  // Line 1 fade-in (no typing)  // L2 fade-in

  useEffect(() => {  useEffect(() => {

    const t = setTimeout(() => setShowLine1(true), timings.lines.l1Delay);    const t = setTimeout(() => setShowLine2(true), timings.lines.l2FadeDelay);

    return () => clearTimeout(t);    return () => clearTimeout(t);

  }, []);  }, []);



  // Line 2 fade-in  // RGB ramp-up

  useEffect(() => {  useEffect(() => {

    const t = setTimeout(() => setShowLine2(true), timings.lines.l2Delay);    const t = setTimeout(() => setRgbIntensity(0.7), timings.entrance.sceneEaseIn);

    return () => clearTimeout(t);    return () => clearTimeout(t);

  }, []);  }, []);



  // RGB pulse (subtle luminance breathing)  // Ambient phase start

  useEffect(() => {  useEffect(() => {

    if (prefersReducedMotion || phase === 'transitioning' || phase === 'exiting') return;    const t = setTimeout(() => setPhase('ambient'), timings.lines.ambientStart);

    const interval = setInterval(() => {    return () => clearTimeout(t);

      setRgbPulse((prev) => (prev >= 1.0 ? 0.92 : 1.0));  }, []);

    }, timings.lines.pulseDuration / 2);

    return () => clearInterval(interval);  // Snippet carousel

  }, [phase, prefersReducedMotion]);  useEffect(() => {

    if (phase !== 'ambient' || !snippets.length) return;

  // Ambient phase    const duration = timings.snippet.fadeIn + timings.snippet.hold + timings.snippet.fadeOut - timings.snippet.overlap;

  useEffect(() => {    const iv = setInterval(() => {

    const t = setTimeout(() => setPhase('ambient'), timings.ambient.start);      setCurrentSnippetIndex(prev => {

    return () => clearTimeout(t);        const next = (prev + 1) % snippets.length;

  }, []);        console.log('[Telemetry] micro_dream.snippet_show', { id: snippets[next]?.id, index: next, chars: snippets[next]?.text.length });

        return next;

  // Snippet carousel (only during ambient)      });

  useEffect(() => {    }, duration);

    if (phase !== 'ambient' || !snippets.length) return;    return () => clearInterval(iv);

  }, [phase, snippets]);

    const cycleDuration = timings.snippet.fadeIn + timings.snippet.hold + timings.snippet.fadeOut;

    const interval = setInterval(() => {  // Waking transition

      setCurrentSnippetIndex((prev) => {  useEffect(() => {

        const next = (prev + 1) % snippets.length;    const t = setTimeout(() => setPhase('waking'), timings.lines.ambientEnd);

        console.log('[Telemetry] micro_dream.fade_cycle', {    return () => clearTimeout(t);

          snippet_id: snippets[next]?.id,  }, []);

          index: next,

          chars: snippets[next]?.text.length,  // Exit sequence

        });  useEffect(() => {

        return next;    if (phase !== 'waking') return;

      });    setShowPinkMorph(true);

    }, cycleDuration);    const t = setTimeout(() => {

      setPhase('exiting');

    return () => clearInterval(interval);      setTimeout(() => {

  }, [phase, snippets]);        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));

      }, timings.exit.irisIn + 250);

  // Waking phase    }, timings.exit.wakingDuration);

  useEffect(() => {    return () => clearTimeout(t);

    const t = setTimeout(() => {  }, [phase, onComplete, router]);

      console.log('[Telemetry] micro_dream.transition_start', { duration_ms: Date.now() - startTimeRef.current });

      setPhase('waking');  // Keyboard

    }, timings.waking.start);  useEffect(() => {

    return () => clearTimeout(t);    const handle = (e: KeyboardEvent) => {

  }, []);      if (e.key === ' ' || e.key === 'Enter') {

        e.preventDefault();

  // Transition to writer        console.log('[Telemetry] micro_dream.advance_user');

  useEffect(() => {        setPhase('waking');

    if (phase !== 'waking') return;      } else if (e.key === 'Escape') {

        e.preventDefault();

    // Start gradient morph and exposure flash        console.log('[Telemetry] micro_dream.skip');

    const morphTimer = setTimeout(() => {        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));

      setShowExposureFlash(true);      }

      setSkyMorph(1);    };

    }, timings.waking.duration);    window.addEventListener('keydown', handle);

    return () => window.removeEventListener('keydown', handle);

    // Complete transition  }, [onComplete, router]);

    const completeTimer = setTimeout(() => {

      setPhase('exiting');  // Telemetry

      console.log('[Telemetry] micro_dream.complete', {  useEffect(() => {

        algo: dream.algo,    console.log('[Telemetry] micro_dream.view', {

        duration_ms: Date.now() - startTimeRef.current,      algo: dream.algo,

        lines_hash: `${line1.slice(0, 20)}...`,      dominant_primary: dream.dominant_primary,

      });      valence_mean: dream.valence_mean,

      arousal_mean: dream.arousal_mean,

      setTimeout(() => {    });

        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));    return () => {

      }, timings.transition.fadeOut);      if (phase === 'exiting') console.log('[Telemetry] micro_dream.complete');

    }, timings.waking.duration + timings.transition.exposureFlash);    };

  }, [phase, dream]);

    return () => {

      clearTimeout(morphTimer);  const currentSnippet = snippets[currentSnippetIndex];

      clearTimeout(completeTimer);

    };  return (

  }, [phase, onComplete, router, dream.algo, line1]);    <div className="fixed inset-0 overflow-hidden" onClick={() => { setPhase('waking'); }}>

      {/* Night sky → Pink morph */}

  // Keyboard controls      <motion.div

  useEffect(() => {        className="absolute inset-0"

    const handleKey = (e: KeyboardEvent) => {        animate={{

      if (e.key === ' ' || e.key === 'Enter') {          background: showPinkMorph

        e.preventDefault();            ? 'linear-gradient(135deg, #ff6aa0, #ff8ec0, #ffd0e3)'

        console.log('[Telemetry] micro_dream.advance_user');            : 'linear-gradient(135deg, #0a0030, #18003a, #001a2a)',

        setPhase('waking');        }}

      } else if (e.key === 'Escape') {        transition={{ duration: timings.exit.morphToPink / 1000 }}

        e.preventDefault();      />

        console.log('[Telemetry] micro_dream.skip');

        onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));      {/* RGB Glows */}

      }      <motion.div

    };        className="absolute inset-0"

    window.addEventListener('keydown', handleKey);        animate={{ opacity: rgbIntensity }}

    return () => window.removeEventListener('keydown', handleKey);        transition={{ duration: timings.entrance.sceneEaseIn / 1000 }}

  }, [onComplete, router]);      >

        <div className="absolute mix-blend-screen" style={{

  // Preload writer route          left: '25%', top: '65%', width: '60vmax', height: '60vmax',

  useEffect(() => {          background: `radial-gradient(circle, rgba(255, 70, 90, ${0.35 + theme.blueBoost * 0.3}) 0%, transparent 70%)`,

    const t = setTimeout(() => {          filter: 'blur(100px)', transform: 'translate(-50%, -50%)',

      router.prefetch('/reflect/' + (window.location.pathname.split('/').pop() || ''));        }} />

    }, 3000);        <div className="absolute mix-blend-screen" style={{

    return () => clearTimeout(t);          right: '20%', top: '30%', width: '50vmax', height: '50vmax',

  }, [router]);          background: `radial-gradient(circle, rgba(60, 255, 170, ${0.30 - theme.blueBoost * 0.2}) 0%, transparent 70%)`,

          filter: 'blur(100px)', transform: 'translate(50%, -50%)',

  // Telemetry view        }} />

  useEffect(() => {        <div className="absolute mix-blend-screen" style={{

    console.log('[Telemetry] micro_dream.view', {          left: '50%', bottom: '0', width: '70vmax', height: '70vmax',

      algo: dream.algo,          background: `radial-gradient(circle, rgba(90, 150, 255, ${0.32 + theme.blueBoost}) 0%, transparent 70%)`,

      dominant_primary: dream.dominant_primary,          filter: 'blur(120px)', transform: 'translate(-50%, 50%)',

      valence_mean: dream.valence_mean,        }} />

      arousal_mean: dream.arousal_mean,      </motion.div>

      snippet_count: snippets.length,

    });      {/* Stars */}

  }, [dream, snippets.length]);      <div className="absolute inset-0 pointer-events-none">

        {Array.from({ length: 50 }).map((_, i) => (

  const currentSnippet = snippets[currentSnippetIndex];          <motion.div

  const isExiting = phase === 'transitioning' || phase === 'exiting';            key={i}

            className="absolute w-0.5 h-0.5 bg-white/60 rounded-full"

  return (            style={{

    <div className="fixed inset-0 overflow-hidden bg-black">              left: `${Math.random() * 100}%`,

      {/* Sky Layer — Deep indigo gradient with slow hue rotate */}              top: `${Math.random() * 60}%`,

      <motion.div            }}

        className="absolute inset-0"            animate={{ opacity: [0.3, 0.8, 0.3] }}

        initial={{ opacity: 0 }}            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}

        animate={{          />

          opacity: 1,        ))}

          background: skyMorph > 0.5      </div>

            ? `linear-gradient(135deg, #ff66a0, #ff8ec0, #ffb7c8)`

            : `linear-gradient(135deg, #08001d, #150033, #2b0060)`,      {/* Clouds */}

          filter: `hue-rotate(${theme.hueRotate * (1 - skyMorph)}deg)`,      {!prefersReducedMotion && (

        }}        <>

        transition={{          {[0, 1, 2].map((i) => (

          opacity: { duration: timings.entrance.skyFadeIn / 1000 },            <motion.div

          background: { duration: timings.transition.gradientMorph / 1000, ease: 'easeInOut' },              key={i}

          filter: { duration: timings.transition.gradientMorph / 1000 },              className="absolute h-20 rounded-full bg-white/5 backdrop-blur-sm"

        }}              style={{

      />                top: `${15 + i * 12}%`,

                width: `${120 + i * 40}px`,

      {/* Animated stars (twinkle slowly) */}                left: `-${120 + i * 40}px`,

      <AnimatePresence>              }}

        {skyMorph < 0.5 && (              animate={{ x: ['0vw', '110vw'] }}

          <motion.div              transition={{ duration: 35 + i * 15, repeat: Infinity, ease: 'linear' }}

            className="absolute inset-0 pointer-events-none"            />

            exit={{ opacity: 0 }}          ))}

            transition={{ duration: timings.transition.gradientMorph / 1000 }}        </>

          >      )}

            {Array.from({ length: 60 }).map((_, i) => (

              <motion.div      {/* Pig (breathing, idle float) */}

                key={i}      <motion.div

                className="absolute w-0.5 h-0.5 bg-white rounded-full"        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"

                style={{        initial={{ opacity: 0, y: 10 }}

                  left: `${Math.random() * 100}%`,        animate={{

                  top: `${Math.random() * 65}%`,          opacity: phase === 'exiting' ? 0 : 0.9,

                }}          y: prefersReducedMotion ? 0 : [0, -6, 0],

                animate={        }}

                  prefersReducedMotion        transition={{

                    ? { opacity: 0.7 }          opacity: { duration: timings.entrance.sceneEaseIn / 1000 },

                    : { opacity: [0.6, 0.9, 0.6] }          y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },

                }        }}

                transition={{      >

                  duration: 4 + Math.random() * 3,        <PinkPig size={180} className="filter drop-shadow-[0_0_40px_rgba(255,150,200,0.4)]" />

                  repeat: Infinity,      </motion.div>

                  delay: Math.random() * 3,

                  ease: 'easeInOut',      {/* Comic skyline silhouettes (parallax) */}

                }}      {!prefersReducedMotion && (

              />        <>

            ))}          <motion.div

          </motion.div>            className="absolute bottom-0 left-0 right-0 h-32"

        )}            style={{

      </AnimatePresence>              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,80 L50,80 L50,40 L100,40 L100,80 L200,80 L200,20 L250,20 L250,80 L400,80 L400,50 L450,50 L450,80 L600,80 L600,30 L650,30 L650,80 L800,80 L800,60 L850,60 L850,80 L1000,80 L1000,45 L1050,45 L1050,80 L1200,80 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.08)\' /%3E%3C/svg%3E")',

              backgroundSize: 'cover',

      {/* Drifting cloud bands */}              backgroundRepeat: 'no-repeat',

      <AnimatePresence>            }}

        {!prefersReducedMotion && skyMorph < 0.5 && (            animate={{ x: [0, -20, 0] }}

          <>            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}

            {[0, 1].map((i) => (          />

              <motion.div          <motion.div

                key={i}            className="absolute bottom-0 left-0 right-0 h-24 opacity-60"

                className="absolute rounded-full"            style={{

                style={{              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1200 100\'%3E%3Cpath d=\'M0,90 L100,90 L100,70 L150,70 L150,90 L300,90 L300,60 L350,60 L350,90 L500,90 L500,75 L550,75 L550,90 L700,90 L700,65 L750,65 L750,90 L900,90 L900,80 L950,80 L950,90 L1200,90 L1200,100 L0,100 Z\' fill=\'rgba(255,255,255,0.05)\' /%3E%3C/svg%3E")',

                  top: `${18 + i * 15}%`,              backgroundSize: 'cover',

                  width: `${180 + i * 60}px`,              backgroundRepeat: 'no-repeat',

                  height: `${25 + i * 8}px`,            }}

                  background: skyMorph > 0.3 ? 'rgba(255, 200, 220, 0.08)' : 'rgba(255, 255, 255, 0.05)',            animate={{ x: [0, 15, 0] }}

                  filter: `blur(${80 + i * 20}px)`,            transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}

                  left: `-${180 + i * 60}px`,          />

                }}        </>

                animate={{      )}

                  x: ['0vw', '110vw'],

                  background: skyMorph > 0.3 ? 'rgba(255, 200, 220, 0.12)' : 'rgba(255, 255, 255, 0.05)',      {/* Lines + Snippet */}

                }}      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 md:px-12 z-10">

                exit={{ opacity: 0 }}        <motion.div

                transition={{          className="max-w-4xl text-center space-y-5"

                  x: { duration: 45 + i * 20, repeat: Infinity, ease: 'linear' },          animate={phase === 'waking' || phase === 'exiting' ? { opacity: 0, filter: 'saturate(140%) blur(1.2px)' } : {}}

                  background: { duration: timings.transition.gradientMorph / 1000 },          transition={{ duration: timings.exit.dissolve / 1000 }}

                  opacity: { duration: timings.transition.fadeOut / 1000 },        >

                }}          {/* L1 */}

              />          <motion.h1

            ))}            className="text-4xl md:text-6xl lg:text-7xl font-serif leading-tight tracking-wide text-white/95"

          </>            style={{

        )}              textShadow: `

      </AnimatePresence>                0 0 20px rgba(255, 255, 255, 0.3),

                2px 2px 6px rgba(255, 255, 255, 0.2),

      {/* RGB Backglow Layers (soft, pulsing) */}                -1px -1px 4px rgba(255, 100, 100, 0.08),

      <motion.div                1px -1px 4px rgba(100, 255, 100, 0.08),

        className="absolute inset-0 pointer-events-none"                -1px 1px 4px rgba(100, 100, 255, 0.08)

        animate={{              `,

          opacity: isExiting ? 0 : rgbPulse * 0.85,            }}

          scale: prefersReducedMotion ? 1 : 1.0 + (1.0 - rgbPulse) * 0.02,            animate={!prefersReducedMotion && line1Text === line1 ? { scale: [1, 1.015, 1] } : {}}

        }}            transition={{ duration: timings.lines.bloomDuration / 1000 }}

        transition={{          >

          opacity: { duration: isExiting ? timings.transition.fadeOut / 1000 : timings.lines.pulseDuration / 2000, ease: 'easeInOut' },            {line1Text}

          scale: { duration: timings.lines.pulseDuration / 2000, ease: 'easeInOut' },          </motion.h1>

        }}

      >          {/* L2 */}

        {/* R glow */}          <AnimatePresence>

        <div            {showLine2 && (

          className="absolute mix-blend-screen"              <motion.p

          style={{                initial={{ opacity: 0, y: 2 }}

            left: '25%',                animate={{ opacity: 0.85, y: 0 }}

            top: '65%',                className="text-xl md:text-2xl text-white/85"

            width: '55vmax',                style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.25)' }}

            height: '55vmax',              >

            background: `radial-gradient(circle, rgba(255, 80, 100, ${theme.rgbShift.r}) 0%, transparent 65%)`,                {line2}

            filter: 'blur(90px)',              </motion.p>

            transform: 'translate(-50%, -50%)',            )}

          }}          </AnimatePresence>

        />

        {/* G glow */}          {/* Snippet carousel */}

        <div          {phase === 'ambient' && currentSnippet && (

          className="absolute mix-blend-screen"            <div className="mt-6 h-12 flex items-center justify-center">

          style={{              <AnimatePresence mode="wait">

            right: '30%',                <motion.div

            top: '35%',                  key={currentSnippet.id}

            width: '48vmax',                  initial={{ opacity: 0 }}

            height: '48vmax',                  animate={{ opacity: 0.7 }}

            background: `radial-gradient(circle, rgba(70, 255, 180, ${theme.rgbShift.g}) 0%, transparent 65%)`,                  exit={{ opacity: 0 }}

            filter: 'blur(85px)',                  transition={{

            transform: 'translate(50%, -50%)',                    opacity: { duration: timings.snippet.fadeIn / 1000 },

          }}                  }}

        />                  className="text-base md:text-lg text-white/80 italic max-w-[45ch] text-center"

        {/* B glow */}                  style={{

        <div                    textShadow: `

          className="absolute mix-blend-screen"                      0 0 10px rgba(255, 200, 255, 0.2),

          style={{                      0 0 18px rgba(150, 150, 255, 0.18)

            left: '50%',                    `,

            top: '80%',                  }}

            width: '65vmax',                >

            height: '65vmax',                  <span className="text-white/50 text-sm not-italic">From earlier: </span>

            background: `radial-gradient(circle, rgba(100, 160, 255, ${theme.rgbShift.b}) 0%, transparent 65%)`,                  {currentSnippet.text}

            filter: 'blur(95px)',                </motion.div>

            transform: 'translate(-50%, -50%)',              </AnimatePresence>

          }}            </div>

        />          )}

      </motion.div>        </motion.div>

      </div>

      {/* Mid Layer — Pig Dreaming */}

      <motion.div      {/* Footer pill */}

        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-10"      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">

        initial={{ opacity: 0, y: 20 }}        <motion.div

        animate={{          initial={{ opacity: 0, y: 8 }}

          opacity: isExiting ? 0 : 0.8,          animate={{ opacity: 1, y: 0 }}

          y: prefersReducedMotion ? 0 : [0, -6, 0],          transition={{ delay: 0.4, duration: 0.5 }}

          scale: prefersReducedMotion ? 1 : [1.0, 1.03, 1.0],          className="backdrop-blur-md bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-sm text-white/90 tracking-wide"

        }}        >

        transition={{          {phase === 'waking' || phase === 'exiting' ? `${pigName} is waking up…` : `${pigName}'s dreamscape`}

          opacity: {        </motion.div>

            duration: timings.entrance.pigFadeIn / 1000,      </div>

            delay: timings.entrance.pigDelay / 1000,

          },      {/* Entrance fade */}

          y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },      <AnimatePresence>

          scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },        {phase === 'entering' && (

        }}          <motion.div

        style={{ mixBlendMode: 'screen' }}            initial={{ opacity: 0.6 }}

      >            animate={{ opacity: 0 }}

        <PinkPig size={200} className="filter drop-shadow-[0_0_50px_rgba(255,180,220,0.5)]" />            transition={{ duration: timings.entrance.fadeIn / 1000 }}

            className="absolute inset-0 bg-black pointer-events-none z-20"

        {/* Sparkle dust particles */}          />

        {!prefersReducedMotion && (        )}

          <>      </AnimatePresence>

            {[0, 1, 2].map((i) => (

              <motion.div      {/* Exit iris */}

                key={i}      <AnimatePresence>

                className="absolute w-1 h-1 bg-white/70 rounded-full"        {phase === 'exiting' && (

                style={{          <motion.div

                  left: `${30 + i * 25}%`,            initial={{ clipPath: 'circle(100% at 50% 50%)' }}

                  top: `${40 + i * 10}%`,            animate={{ clipPath: 'circle(0% at 50% 50%)' }}

                }}            transition={{ duration: timings.exit.irisIn / 1000, ease: 'easeIn' }}

                animate={{            className="absolute inset-0 bg-white pointer-events-none z-50"

                  opacity: [0.3, 0.8, 0.3],          />

                  y: [-10, -30, -50],        )}

                  x: [0, (i - 1) * 10, (i - 1) * 15],      </AnimatePresence>

                }}

                transition={{      {/* Screen reader */}

                  duration: 4 + i * 0.5,      <div className="sr-only" role="status" aria-live="polite">

                  repeat: Infinity,        {line1Text} {showLine2 ? line2 : ''}

                  delay: i * 1.2,      </div>

                  ease: 'easeOut',      <a

                }}        href="#skip"

              />        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:z-50"

            ))}        onClick={(e) => {

          </>          e.preventDefault();

        )}          onComplete ? onComplete() : router.push('/reflect/' + (window.location.pathname.split('/').pop() || ''));

      </motion.div>        }}

      >

      {/* Comic Skyline Silhouettes (parallax) */}        Skip dream and start writing

      <AnimatePresence>      </a>

        {!prefersReducedMotion && (    </div>

          <>  );

            {/* Back layer */}}

            <motion.div
              className="absolute bottom-0 left-0 right-0 h-28 opacity-60 z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: isExiting ? 0 : 0.6,
                y: 0,
                x: [0, -15, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: timings.entrance.skyFadeIn / 1000 },
                x: { duration: 40, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 100'%3E%3Cpath d='M0,90 L100,90 L100,70 L150,70 L150,90 L300,90 L300,60 L350,60 L350,90 L500,90 L500,75 L550,75 L550,90 L700,90 L700,65 L750,65 L750,90 L900,90 L900,80 L950,80 L950,90 L1200,90 L1200,100 L0,100 Z' fill='rgba(255,255,255,0.06)' filter='url(%23glow)' /%3E%3Cdefs%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='2' /%3E%3C/filter%3E%3C/defs%3E%3C/svg%3E")`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
              }}
            />

            {/* Front layer */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-36 z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: isExiting ? 0 : 0.75,
                y: 0,
                x: [0, 20, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: timings.entrance.skyFadeIn / 1000 },
                x: { duration: 30, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 100'%3E%3Cpath d='M0,80 L50,80 L50,40 L100,40 L100,80 L200,80 L200,20 L250,20 L250,80 L400,80 L400,50 L450,50 L450,80 L600,80 L600,30 L650,30 L650,80 L800,80 L800,60 L850,60 L850,80 L1000,80 L1000,45 L1050,45 L1050,80 L1200,80 L1200,100 L0,100 Z' fill='rgba(255,255,255,0.08)' filter='url(%23glow2)' /%3E%3Cdefs%3E%3Cfilter id='glow2'%3E%3CfeGaussianBlur stdDeviation='3' /%3E%3C/filter%3E%3C/defs%3E%3C/svg%3E")`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Top Header (soft, translucent) */}
      <motion.div
        className="absolute top-6 left-0 right-0 flex justify-between items-center px-6 z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 0.7 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        <div className="bg-white/5 backdrop-blur-md rounded-full px-3 py-1 text-sm text-white/80">
          Sign-in #{(dream as any).signin_count || '—'}
        </div>
        <div className="bg-white/5 backdrop-blur-md rounded-full px-3 py-1 text-sm text-white/80">
          🔊
        </div>
      </motion.div>

      {/* Text Cluster (center) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 md:px-12 z-25">
        <motion.div
          className="max-w-4xl text-center space-y-6"
          animate={{
            opacity: isExiting ? 0 : 1,
            filter: isExiting ? 'blur(6px)' : 'blur(0px)',
          }}
          transition={{ duration: timings.transition.fadeOut / 1000 }}
        >
          {/* Line 1 — Display Serif, fade in + pulse */}
          <AnimatePresence>
            {showLine1 && (
              <motion.h1
                initial={{ opacity: 0, filter: 'blur(8px)' }}
                animate={{
                  opacity: 0.9,
                  filter: 'blur(0px)',
                  scale: prefersReducedMotion ? 1 : [1.0, 1.015, 1.0],
                }}
                transition={{
                  opacity: { duration: timings.lines.l1FadeIn / 1000, ease: 'easeOut' },
                  filter: { duration: timings.lines.l1FadeIn / 1000 },
                  scale: { duration: timings.lines.pulseDuration / 1000, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="text-5xl md:text-7xl font-serif leading-tight tracking-wide text-white/90"
                style={{
                  fontFamily: "'Playfair Display', 'Fraunces', serif",
                  textShadow: `
                    0 0 12px rgba(255, 255, 255, 0.15),
                    0 0 30px rgba(160, 100, 255, 0.25),
                    0 0 8px rgba(255, 255, 255, 0.1)
                  `,
                }}
              >
                {line1}
              </motion.h1>
            )}
          </AnimatePresence>

          {/* Line 2 — Sans SemiBold, fade in */}
          <AnimatePresence>
            {showLine2 && (
              <motion.p
                initial={{ opacity: 0, filter: 'blur(6px)' }}
                animate={{ opacity: 0.8, filter: 'blur(0px)' }}
                transition={{
                  opacity: { duration: timings.lines.l2FadeIn / 1000, ease: 'easeOut' },
                  filter: { duration: timings.lines.l2FadeIn / 1000 },
                }}
                className="text-xl md:text-2xl font-semibold text-white/80"
                style={{
                  textShadow: `
                    0 0 10px rgba(255, 255, 255, 0.12),
                    0 0 24px rgba(120, 180, 255, 0.20)
                  `,
                }}
              >
                {line2}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Reflection snippet fade loop (reserved space) */}
          <div className="h-16 flex items-center justify-center mt-4">
            <AnimatePresence mode="wait">
              {phase === 'ambient' && currentSnippet && (
                <motion.div
                  key={currentSnippet.id}
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 0.7, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{
                    duration: timings.snippet.fadeIn / 1000,
                    ease: 'easeInOut',
                  }}
                  className="text-lg italic text-white/70 max-w-[50ch] text-center"
                  style={{
                    textShadow: `
                      0 0 8px rgba(200, 220, 255, 0.18),
                      0 0 16px rgba(180, 150, 255, 0.15)
                    `,
                  }}
                >
                  <span className="text-white/50 text-sm not-italic">From earlier: </span>
                  {currentSnippet.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Footer Pill (glass effect) */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isExiting ? 0 : 1, y: 0 }}
        transition={{
          opacity: { duration: 0.5, delay: 0.4 },
          y: { duration: 0.5, delay: 0.4 },
        }}
      >
        <div
          className="backdrop-blur-md border rounded-full px-5 py-2 text-sm tracking-wide uppercase"
          style={{
            background: `rgba(255, 255, 255, 0.08)`,
            borderColor: `rgba(${theme.rgbShift.r * 255}, ${theme.rgbShift.g * 255}, ${theme.rgbShift.b * 255}, 0.2)`,
            color: 'rgba(255, 255, 255, 0.85)',
            boxShadow: `0 0 20px rgba(${theme.rgbShift.r * 255}, ${theme.rgbShift.g * 255}, ${theme.rgbShift.b * 255}, 0.15)`,
          }}
        >
          {phase === 'waking' || isExiting ? `${pigName} is waking up…` : `${pigName}'s dreamscape`}
        </div>
      </motion.div>

      {/* Exposure Flash (filmic transition) */}
      <AnimatePresence>
        {showExposureFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: timings.transition.exposureFlash / 1000, ease: 'easeInOut' }}
            className="absolute inset-0 bg-white pointer-events-none z-40"
          />
        )}
      </AnimatePresence>

      {/* Accessibility — Screen reader */}
      <div className="sr-only" role="status" aria-live="polite">
        {showLine1 ? line1 : ''} {showLine2 ? line2 : ''}
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

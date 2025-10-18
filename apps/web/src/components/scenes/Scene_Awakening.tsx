'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Fury from '@/components/fury/Fury';
import { useAudio } from '@/providers/AudioProvider';
import { useSceneState } from '@/providers/SceneStateProvider';
import { AudioEngine } from '@/lib/audio/AudioEngine';
import {
  calcArousalFromSwipe,
  calcDepthFromHold,
  calcClarityFromReleaseSlope,
  calcAuthenticityFromPathStability,
  calcEffortFromSession,
  calcValenceFromLightTemperature,
  calcPathSmoothness,
  composeAffect,
} from '@/lib/affect/metrics';
import {
  getEntryContext,
  markVisited,
  persistAffectLocal,
} from '@/lib/session/session';
import dialogue from '@/lib/copy/awakening.dialogue.json';

type LightZone = 'dawn' | 'noon' | 'dusk';

export default function SceneAwakening() {
  const router = useRouter();
  const { data: session } = useSession();
  const audio = useAudio();
  const { entry, setEntry, setAffect, affect } = useSceneState();

  // Gesture tracking state
  const [featherSpeed, setFeatherSpeed] = useState<number[]>([]);
  const [pebbleHoldStart, setPebbleHoldStart] = useState<number | null>(null);
  const [pebbleHoldDuration, setPebbleHoldDuration] = useState(0);
  const [orbPath, setOrbPath] = useState<{ x: number; y: number }[]>([]);
  const [lightZone, setLightZone] = useState<LightZone>('noon');
  const [interactionCount, setInteractionCount] = useState(0);
  const [sessionStart] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [showSignInNudge, setShowSignInNudge] = useState(false);

  // Motion values for orb dragging
  const orbX = useMotionValue(0);
  const orbY = useMotionValue(0);

  // Dialogue line selection
  const [dialogueLine, setDialogueLine] = useState('');

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Initialize audio and determine entry context
  useEffect(() => {
    const init = async () => {
      if (!audio.initialized) {
        await audio.init();
      }

      const context = getEntryContext(!!session?.user);
      setEntry(context);

      // Select dialogue line
      const lines = dialogue[context];
      const randomLine = lines[Math.floor(Math.random() * lines.length)];
      setDialogueLine(randomLine);

      // Show sign-in nudge for guests after 15s
      if (context === 'guest') {
        setTimeout(() => setShowSignInNudge(true), 15000);
      }
    };

    init();
  }, [session, audio, setEntry]);

  // Start ambient audio on first interaction
  const handleFirstInteraction = () => {
    if (!audio.playing) {
      audio.play();
    }
  };

  // Feather swipe handler
  const handleFeatherSwipe = (e: React.PointerEvent) => {
    handleFirstInteraction();

    const speed = Math.abs(e.movementX) + Math.abs(e.movementY);
    setFeatherSpeed((prev) => [...prev.slice(-9), speed]);
    setInteractionCount((c) => c + 1);

    // Update arousal and tempo
    const arousal = calcArousalFromSwipe([...featherSpeed, speed]);
    setAffect({ arousal });
    AudioEngine.setTempo(60 + arousal * 60); // 60-120 BPM

    // Persist for guests
    if (entry === 'guest' && affect) {
      persistAffectLocal({ ...affect, arousal });
    }
  };

  // Pebble press/hold handlers
  const handlePebblePress = () => {
    handleFirstInteraction();
    setPebbleHoldStart(Date.now());
    setInteractionCount((c) => c + 1);
  };

  const handlePebbleRelease = () => {
    if (!pebbleHoldStart) return;

    const duration = Date.now() - pebbleHoldStart;
    setPebbleHoldDuration(duration);

    const depth = calcDepthFromHold(duration);
    const releaseSlope = duration < 1000 ? 100 : 10; // Quick vs slow release
    const clarity = calcClarityFromReleaseSlope(releaseSlope);

    setAffect({ depth, clarity });
    setPebbleHoldStart(null);

    // Persist for guests
    if (entry === 'guest' && affect) {
      persistAffectLocal({ ...affect, depth, clarity });
    }
  };

  // Orb drag handlers
  const handleOrbDrag = (e: PointerEvent, info: any) => {
    handleFirstInteraction();

    const newPoint = { x: info.point.x, y: info.point.y };
    setOrbPath((prev) => [...prev.slice(-19), newPoint]);
    setInteractionCount((c) => c + 1);

    // Determine light zone based on Y position
    const viewport = window.innerHeight;
    if (info.point.y < viewport * 0.33) {
      setLightZone('dawn');
    } else if (info.point.y > viewport * 0.67) {
      setLightZone('dusk');
    } else {
      setLightZone('noon');
    }

    // Update authenticity and valence
    if (orbPath.length > 3) {
      const smoothness = calcPathSmoothness([...orbPath, newPoint]);
      const authenticity = calcAuthenticityFromPathStability(smoothness);
      const valence = calcValenceFromLightTemperature(lightZone);

      setAffect({ authenticity, valence });
      AudioEngine.setWarmth((valence + 1) / 2); // Map -1..1 to 0..1

      // Persist for guests
      if (entry === 'guest' && affect) {
        persistAffectLocal({ ...affect, authenticity, valence });
      }
    }
  };

  // Check for completion (after sufficient interaction)
  useEffect(() => {
    const minInteractions = 12;
    const minTime = 20000; // 20 seconds

    if (
      interactionCount >= minInteractions &&
      Date.now() - sessionStart >= minTime &&
      !isComplete
    ) {
      handleCompletion();
    }
  }, [interactionCount, sessionStart, isComplete]);

  // Handle scene completion
  const handleCompletion = async () => {
    setIsComplete(true);

    // Compute final affect vector
    const arousal = calcArousalFromSwipe(featherSpeed);
    const depth = calcDepthFromHold(pebbleHoldDuration);
    const clarity = calcClarityFromReleaseSlope(pebbleHoldDuration < 1000 ? 100 : 10);
    const authenticity = calcAuthenticityFromPathStability(calcPathSmoothness(orbPath));
    const valence = calcValenceFromLightTemperature(lightZone);
    const effort = calcEffortFromSession(Date.now() - sessionStart, interactionCount);

    const finalAffect = composeAffect(
      arousal,
      depth,
      clarity,
      authenticity,
      effort,
      valence,
      `feather_pebble_orb_v1`
    );

    setAffect(finalAffect);

    // Persist
    if (session?.user) {
      // Send to API
      try {
        await fetch('/api/affect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affect: finalAffect,
            scene: 'awakening',
            timestamp: new Date().toISOString(),
          }),
        });
        markVisited();
      } catch (error) {
        console.error('Failed to persist affect:', error);
      }
    } else {
      // Guest: save to localStorage
      persistAffectLocal(finalAffect);
    }

    // Navigate to spin after 2s
    setTimeout(() => {
      const seed = encodeURIComponent(finalAffect.seed || 'default');
      router.push(`/spin?seed=${seed}`);
    }, 2000);
  };

  // Background gradient based on light zone
  const bgGradient = {
    dawn: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    noon: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    dusk: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  }[lightZone];

  const particleCount = prefersReducedMotion ? 20 : 60;

  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden px-4"
      style={{
        background: bgGradient,
        transition: 'background 2s ease',
      }}
    >
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(particleCount)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              filter: 'blur(1px)',
            }}
            animate={{
              y: prefersReducedMotion ? 0 : [0, -100, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>

      {/* Fury companion */}
      <motion.div
        className="absolute top-8 right-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <Fury size={100} mood="calm" />
      </motion.div>

      {/* Sign out button */}
      {session?.user && (
        <motion.button
          onClick={() => signOut({ callbackUrl: '/p/testpig' })}
          className="absolute top-8 left-8 text-sm text-pink-800/60 hover:text-pink-900 transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Sign out
        </motion.button>
      )}

      {/* Dialogue */}
      <motion.p
        className="text-pink-900 text-base font-serif italic text-center max-w-md mb-12 px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
      >
        {dialogueLine}
      </motion.p>

      {/* Interactive objects container */}
      <div className="relative w-full max-w-md h-[60vh] flex flex-col justify-around items-center">
        {/* Feather - swipe to affect arousal */}
        <motion.div
          className="w-20 h-20 cursor-pointer"
          onPointerMove={handleFeatherSwipe}
          whileHover={{ scale: 1.1 }}
          animate={{
            y: [0, -10, 0],
            rotate: [-5, 5, -5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 rounded-full opacity-70 flex items-center justify-center text-4xl">
            🪶
          </div>
        </motion.div>

        {/* Pebble - hold to affect depth/clarity */}
        <motion.div
          className="w-24 h-24 cursor-pointer relative"
          onPointerDown={handlePebblePress}
          onPointerUp={handlePebbleRelease}
          onPointerLeave={handlePebbleRelease}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-5xl">
            🪨
          </div>
          {/* Ripple effect while holding */}
          {pebbleHoldStart && (
            <motion.div
              className="absolute inset-0 border-2 border-pink-300 rounded-full"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>

        {/* Echo Orb - drag to affect authenticity/valence */}
        <motion.div
          className="w-28 h-28 cursor-grab active:cursor-grabbing"
          drag
          dragConstraints={{ left: -150, right: 150, top: -150, bottom: 150 }}
          dragElastic={0.2}
          onDrag={handleOrbDrag}
          style={{ x: orbX, y: orbY }}
          whileHover={{ scale: 1.1 }}
        >
          <motion.div
            className="w-full h-full bg-gradient-to-br from-blue-200/60 to-purple-300/60 rounded-full backdrop-blur-sm flex items-center justify-center text-6xl"
            animate={{
              boxShadow: [
                '0 0 20px rgba(139, 92, 246, 0.3)',
                '0 0 40px rgba(139, 92, 246, 0.5)',
                '0 0 20px rgba(139, 92, 246, 0.3)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            🔮
          </motion.div>
        </motion.div>
      </div>

      {/* Completion cue */}
      {isComplete && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.p
            className="text-white text-xl font-serif italic text-center px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {dialogue.completion[Math.floor(Math.random() * dialogue.completion.length)]}
          </motion.p>
        </motion.div>
      )}

      {/* Guest sign-in nudge */}
      {showSignInNudge && entry === 'guest' && !isComplete && (
        <motion.div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 px-6 py-4 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <p className="text-pink-900 text-sm font-serif italic text-center">
            {dialogue.signInNudge.copy}
          </p>
          <button
            onClick={() => signIn('google')}
            className="px-6 py-2 bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-full font-medium text-sm shadow-lg hover:shadow-xl transition-shadow"
          >
            {dialogue.signInNudge.button}
          </button>
        </motion.div>
      )}
    </section>
  );
}

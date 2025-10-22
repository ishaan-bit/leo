'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PinkPig from '../molecules/PinkPig';
import type { PrimaryEmotion } from '@/lib/zones';

interface YourMomentProps {
  reflectionId: string;
  primary: PrimaryEmotion;
  secondary?: string;
  zoneName: string;
  zoneColor: string;
  breathTempo: number; // Inherited from breathing phase (ms per cycle)
  pigName: string;
  onComplete: () => void;
}

interface Stage2Payload {
  poems: [string, string];
  tips: string[];
  closing_line?: string;
  tip_moods?: string[];
}

type Phase = 'continuity' | 'poem1' | 'tips' | 'poem2' | 'closing';

const EMOTION_FALLBACK_CONTENT: Record<PrimaryEmotion, Stage2Payload> = {
  joyful: {
    poems: [
      "Joy blooms where attention lingers",
      "Every moment holds its own light"
    ],
    tips: [
      "Notice what makes you smile today",
      "Share your brightness with someone",
      "Let happiness ripple outward"
    ],
    closing_line: "Your joy is a gift to yourself and others"
  },
  powerful: {
    poems: [
      "Strength flows through gentle persistence",
      "You are the architect of your becoming"
    ],
    tips: [
      "Channel energy into clear intention",
      "Set one boundary with compassion",
      "Celebrate your quiet power"
    ],
    closing_line: "Your power grows in purposeful action"
  },
  peaceful: {
    poems: [
      "Stillness speaks in whispers",
      "Peace is found in the spaces between"
    ],
    tips: [
      "Rest without guilt today",
      "Notice one moment of ease",
      "Let calm be your companion"
    ],
    closing_line: "Peace is always available within you"
  },
  sad: {
    poems: [
      "Sorrow softens the hardened places",
      "Tears water the seeds of healing"
    ],
    tips: [
      "Feel without fixing today",
      "Reach out if you need support",
      "Sadness is not a failure"
    ],
    closing_line: "Your feelings deserve tender acknowledgment"
  },
  mad: {
    poems: [
      "Anger reveals what matters most",
      "Your fire can forge new paths"
    ],
    tips: [
      "Name what you're protecting",
      "Express safely, then release",
      "Channel heat into purposeful change"
    ],
    closing_line: "Your anger holds important wisdom"
  },
  scared: {
    poems: [
      "Fear shows where courage is needed",
      "You are braver than you feel"
    ],
    tips: [
      "Take one small step forward",
      "Share your fear with someone safe",
      "Remember: you've survived before"
    ],
    closing_line: "Courage is fear that has found its footing"
  }
};

export default function YourMoment({
  reflectionId,
  primary,
  secondary,
  zoneName,
  zoneColor,
  breathTempo,
  pigName,
  onComplete,
}: YourMomentProps) {
  const [phase, setPhase] = useState<Phase>('continuity');
  const [stage2Data, setStage2Data] = useState<Stage2Payload | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [litWindows, setLitWindows] = useState<number[]>([]);
  const [breathProgress, setBreathProgress] = useState(0); // 0 = exhale start, 0.5 = inhale peak, 1 = exhale end
  const [showPrompt, setShowPrompt] = useState(false);
  
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breathAnimRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  // Fetch Stage 2 enrichment data (or use fallback)
  useEffect(() => {
    const fetchStage2 = async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) throw new Error('Failed to fetch reflection');
        
        const reflection = await response.json();
        
        if (reflection.final?.post_enrichment) {
          console.log('[YourMoment] Using enrichment worker data');
          setStage2Data(reflection.final.post_enrichment);
        } else {
          console.log('[YourMoment] Using emotion-based fallback content');
          setStage2Data(EMOTION_FALLBACK_CONTENT[primary]);
        }
      } catch (error) {
        console.error('[YourMoment] Error fetching Stage 2 data:', error);
        setStage2Data(EMOTION_FALLBACK_CONTENT[primary]);
      }
    };

    fetchStage2();
  }, [reflectionId, primary]);

  // Breathing animation loop (inherited rhythm from breathing phase)
  useEffect(() => {
    if (!stage2Data) return;

    const animateBreath = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const cycleProgress = (elapsed % breathTempo) / breathTempo;
      
      // Sine wave for smooth inhale/exhale
      const progress = (Math.sin(cycleProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      setBreathProgress(progress);
      
      breathAnimRef.current = requestAnimationFrame(animateBreath);
    };

    breathAnimRef.current = requestAnimationFrame(animateBreath);

    return () => {
      if (breathAnimRef.current) {
        cancelAnimationFrame(breathAnimRef.current);
      }
    };
  }, [breathTempo, stage2Data]);

  // Phase progression
  useEffect(() => {
    if (!stage2Data) return;

    const schedulePhase = (nextPhase: Phase, delay: number) => {
      phaseTimerRef.current = setTimeout(() => setPhase(nextPhase), delay);
    };

    switch (phase) {
      case 'continuity':
        // Show transition message for 2 breath cycles
        schedulePhase('poem1', breathTempo * 2);
        break;
      
      case 'poem1':
        // Poem 1 shows for 2 breath cycles
        schedulePhase('tips', breathTempo * 2);
        break;
      
      case 'tips':
        // Each tip shows for 1 breath cycle
        if (currentTipIndex < stage2Data.tips.length - 1) {
          setTimeout(() => {
            setCurrentTipIndex(prev => prev + 1);
            setLitWindows(prev => [...prev, currentTipIndex]);
          }, breathTempo);
        } else {
          // All tips shown, move to poem 2
          setLitWindows(prev => [...prev, currentTipIndex]);
          schedulePhase('poem2', breathTempo);
        }
        break;
      
      case 'poem2':
        // Poem 2 shows for 3 breath cycles (slower)
        schedulePhase('closing', breathTempo * 3);
        break;
      
      case 'closing':
        // Show closing prompt
        setShowPrompt(true);
        break;
    }

    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
      }
    };
  }, [phase, stage2Data, breathTempo, currentTipIndex]);

  if (!stage2Data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-indigo-950 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white text-xl font-serif italic"
        >
          Preparing your moment...
        </motion.div>
      </div>
    );
  }

  // Calculate halo scale based on breath progress
  const haloScale = 1 + breathProgress * 0.15;
  const haloOpacity = 0.3 + breathProgress * 0.3;

  // Tip brightness variations
  const getTipBrightness = (index: number) => {
    if (index === 0) return 1.0;
    if (index === 1) return 1.1;
    return 1.2;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-indigo-950 relative overflow-hidden">
      {/* Breathing halo (inherited from breathing phase) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${zoneColor}40, transparent 70%)`,
          scale: haloScale,
          opacity: haloOpacity,
        }}
      />

      {/* City skyline silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/60 to-transparent">
        {/* Tower windows */}
        <div className="absolute bottom-20 left-1/4 w-16 h-48 bg-black/80 rounded-t-sm">
          {[0, 1, 2].map((windowIndex) => (
            <motion.div
              key={windowIndex}
              className="w-8 h-12 m-2 rounded-sm"
              style={{
                backgroundColor: litWindows.includes(windowIndex) 
                  ? `${zoneColor}${Math.floor(getTipBrightness(windowIndex) * 255).toString(16).padStart(2, '0')}`
                  : 'rgba(255,255,255,0.1)',
              }}
              animate={{
                opacity: litWindows.includes(windowIndex) ? [0.6, 1, 0.6] : 0.1,
              }}
              transition={{
                duration: breathTempo / 1000,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>

      {/* Leo pig - center stage */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: breathTempo / 1000,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <PinkPig size={200} state="idle" />
        </motion.div>
      </div>

      {/* Content overlay - synced to breath */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-32">
        <AnimatePresence mode="wait">
          {phase === 'continuity' && (
            <motion.div
              key="continuity"
              initial={{ opacity: 0 }}
              animate={{ opacity: breathProgress > 0.3 ? 1 : 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="text-3xl font-serif italic text-white/90">
                Your moment begins to take shape...
              </p>
            </motion.div>
          )}

          {phase === 'poem1' && (
            <motion.div
              key="poem1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: breathProgress > 0.2 ? 1 : 0.3,
                y: 20 - breathProgress * 10,
              }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-2xl"
            >
              <p className="text-4xl md:text-5xl font-serif italic text-white leading-relaxed">
                {stage2Data.poems[0]}
              </p>
            </motion.div>
          )}

          {phase === 'tips' && (
            <motion.div
              key={`tip-${currentTipIndex}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: breathProgress > 0.2 ? 1 : 0.4, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-center max-w-xl"
            >
              <p className="text-2xl font-sans text-white/80 mb-4">
                {stage2Data.tips[currentTipIndex]}
              </p>
              <div className="text-sm text-white/40 font-mono">
                {currentTipIndex + 1} of {stage2Data.tips.length}
              </div>
            </motion.div>
          )}

          {phase === 'poem2' && (
            <motion.div
              key="poem2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ 
                opacity: breathProgress > 0.3 ? 1 : 0.5,
                scale: 0.95 + breathProgress * 0.05,
              }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="text-center max-w-2xl"
            >
              <p className="text-4xl md:text-5xl font-serif italic text-white leading-relaxed">
                {stage2Data.poems[1]}
              </p>
            </motion.div>
          )}

          {phase === 'closing' && showPrompt && (
            <motion.div
              key="closing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="text-center max-w-lg"
            >
              {/* Sticky note icon */}
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="text-6xl mb-6"
              >
                📝
              </motion.div>

              <p className="text-2xl font-serif text-white/90 mb-4">
                If anything came to mind, write it down and feed it to <span className="text-pink-300">{pigName}</span>.
              </p>

              {stage2Data.closing_line && (
                <p className="text-lg font-sans italic text-white/60 mt-6">
                  {stage2Data.closing_line}
                </p>
              )}

              <button
                onClick={onComplete}
                className="mt-8 px-8 py-3 bg-white/20 hover:bg-white/30 text-white rounded-full font-medium transition-all duration-300 backdrop-blur-sm border border-white/30"
              >
                Continue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ambient stars (reduced from breathing phase) */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}

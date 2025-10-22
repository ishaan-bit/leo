'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { type PrimaryEmotion, computeBreatheParams, FALLBACK_WORDS } from '@/lib/breathe-config';
import type { Stage2State, PostEnrichmentPayload, Stage2Phase, WindowState } from '@/lib/stage2-types';

interface BreathingSequenceProps {
  reflectionId: string;
  primary: PrimaryEmotion;
  secondary?: string;
  zoneName: string;
  zoneColor: string;
  invokedWords?: string[];
  pigName?: string; // For Stage 2 closing cue
  onComplete: () => void;
}

// Emotional towers - repositioned for breathing sequence
// Primary tower positioned at 35% (center-left) for visibility
const TOWERS = [
  { id: 'joyful', name: 'Haven', color: '#FFD700', x: 15, height: 180 },
  { id: 'powerful', name: 'Vire', color: '#FF6B35', x: 25, height: 220 },
  { id: 'peaceful', name: 'Vera', color: '#6A9FB5', x: 40, height: 160 },
  { id: 'sad', name: 'Ashmere', color: '#7D8597', x: 55, height: 200 },
  { id: 'mad', name: 'Sable', color: '#C1121F', x: 70, height: 190 },
  { id: 'scared', name: 'Vanta', color: '#5A189A', x: 85, height: 170 },
];

// Get repositioned X for primary tower (center-left at 35%)
const getPrimaryTowerX = (towerId: string) => {
  return 35; // Center-left position
};

const MIN_CYCLES = 3;
const EASING = [0.42, 0, 0.58, 1] as const; // easeInOutSine

export default function BreathingSequence({
  reflectionId,
  primary,
  secondary,
  zoneName,
  zoneColor,
  invokedWords = [],
  pigName = 'Leo',
  onComplete,
}: BreathingSequenceProps) {
  const [breathProgress, setBreathProgress] = useState(0); // 0-1 continuous
  const [cycleCount, setCycleCount] = useState(0);
  const [words, setWords] = useState<Array<{ id: string; text: string; angle: number }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [stage2Complete, setStage2Complete] = useState(false);
  
  // Stage 2 state
  const [stage2, setStage2] = useState<Stage2State>({
    phase: 'idle',
    payload: null,
    window: null,
    currentTipIndex: 0,
    stage2CycleCount: 0,
    started: false,
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordPool = useRef<string[]>([]);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  
  const breatheParams = computeBreatheParams(primary, secondary);
  const { cycle, color, audio } = breatheParams;
  
  // Slow down to resting pulse (6s) during closing phase
  const activeCycle = stage2.phase === 'closing' 
    ? { in: 3, out: 3 } // 6s resting pulse
    : cycle;
  const cycleDuration = (activeCycle.in + activeCycle.out) * 1000; // ms
  const primaryTower = TOWERS.find(t => t.id === primary) || TOWERS[0];

  // Initialize word pool - ONLY invoked, expressed, primary, secondary, tertiary
  useEffect(() => {
    const initWords = async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) throw new Error('Failed to fetch reflection');
        
        const reflection = await response.json();
        const pool: string[] = [];
        
        // 1. Invoked words (primary source)
        if (invokedWords.length > 0) pool.push(...invokedWords);
        
        // 2. Expressed emotion
        if (reflection.final?.expressed && reflection.final.expressed !== 'null') {
          const expressed = reflection.final.expressed.split(/[+\s]+/).map((w: string) => w.trim()).filter(Boolean);
          pool.push(...expressed);
        }
        
        // 3. Wheel emotions ONLY (no random text words)
        if (reflection.final?.wheel?.primary) pool.push(reflection.final.wheel.primary);
        if (reflection.final?.wheel?.secondary) pool.push(reflection.final.wheel.secondary);
        if (reflection.final?.wheel?.tertiary) pool.push(reflection.final.wheel.tertiary);
        
        // Filter out short/meaningless words
        const filteredPool = pool.filter(w => w && w.length > 2);
        
        wordPool.current = filteredPool.length > 0 ? filteredPool : [...FALLBACK_WORDS];
        console.log('[Breathing] Word pool:', wordPool.current.length, 'words', wordPool.current);
      } catch (error) {
        console.error('[Breathing] Failed to load words:', error);
        wordPool.current = [...FALLBACK_WORDS];
      }
    };
    
    initWords();
  }, [reflectionId, invokedWords]);

  // Start audio and reveal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load audio
    if (audio) {
      const audioEl = new Audio(audio);
      audioEl.loop = true;
      audioEl.volume = 0.6;
      audioEl.play().catch(err => console.warn('[Breathing] Audio play failed:', err));
      audioRef.current = audioEl;
    }
    
    // Reveal delay
    setTimeout(() => setIsReady(true), 2000);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audio]);

  // Poll for Stage-2 enrichment (post_enrichment payload)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/reflect/${reflectionId}`);
        if (!response.ok) return;
        
        const reflection = await response.json();
        
        // Check for post_enrichment payload
        if (reflection.final?.post_enrichment && !stage2.started) {
          const postEnrichment = reflection.final.post_enrichment;
          
          console.log('[Stage2] Post-enrichment received:', postEnrichment);
          
          // Initialize Stage 2 with payload
          setStage2(prev => ({
            ...prev,
            payload: {
              poems: postEnrichment.poems || ['...', '...'],
              tips: postEnrichment.tips || [],
              closing_line: postEnrichment.closing_line || '',
              tip_moods: postEnrichment.tip_moods || [],
            },
            window: {
              lit: false,
              window_id: reflectionId,
              x: 35, // Primary tower X position
              y: 35 + Math.random() * 20, // Mid-height on tower
              opacity: 0,
              glow: 0,
            },
            phase: 'continuity', // Start Stage 2
            started: true,
          }));
        }
        
        // Check for overall completion status
        const status = reflection.status || reflection.final?.status;
        if (status === 'complete') {
          console.log('[Breathing] Stage-2 complete, cycle:', cycleCount);
          setStage2Complete(true);
        }
      } catch (error) {
        console.error('[Breathing] Poll error:', error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [reflectionId, cycleCount, stage2.started]);

  // Continuous breathing animation loop
  useEffect(() => {
    if (!isReady) return;
    
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const cyclePosition = (elapsed % cycleDuration) / cycleDuration;
      
      // 0-0.5 = inhale, 0.5-1 = exhale (simplified, no holds)
      setBreathProgress(cyclePosition);
      
      // Count completed cycles
      const currentCycle = Math.floor(elapsed / cycleDuration);
      if (currentCycle > cycleCount) {
        setCycleCount(currentCycle);
        console.log('[Breathing] Cycle', currentCycle, 'complete');
        
        // Stage 2 phase progression (each phase lasts 1 breath cycle)
        if (stage2.started && stage2.payload) {
          const stage2Cycle = stage2.stage2CycleCount;
          
          // Phase 0 (cycle 0): Continuity handoff
          if (stage2.phase === 'continuity' && stage2Cycle >= 1) {
            console.log('[Stage2] ΓåÆ Poem 1 (ignite window)');
            setStage2(prev => ({ ...prev, phase: 'poem1', stage2CycleCount: stage2Cycle + 1 }));
          }
          // Phase 1 (cycle 1): Poem 1
          else if (stage2.phase === 'poem1' && stage2Cycle >= 2) {
            console.log('[Stage2] ΓåÆ Tips sequence');
            setStage2(prev => ({ ...prev, phase: 'tips', stage2CycleCount: stage2Cycle + 1 }));
          }
          // Phase 2 (cycles 2-N): Tips (1 cycle per tip)
          else if (stage2.phase === 'tips') {
            const tipIndex = stage2.currentTipIndex;
            const totalTips = stage2.payload.tips.length;
            
            if (tipIndex < totalTips - 1) {
              console.log(`[Stage2] ΓåÆ Tip ${tipIndex + 2}/${totalTips}`);
              setStage2(prev => ({ 
                ...prev, 
                currentTipIndex: tipIndex + 1,
                stage2CycleCount: stage2Cycle + 1 
              }));
            } else {
              console.log('[Stage2] ΓåÆ Poem 2 (release)');
              setStage2(prev => ({ ...prev, phase: 'poem2', stage2CycleCount: stage2Cycle + 1 }));
            }
          }
          // Phase 3 (cycle after tips): Poem 2
          else if (stage2.phase === 'poem2' && stage2Cycle >= 3 + stage2.payload.tips.length) {
            console.log('[Stage2] ΓåÆ Closing cue');
            setStage2(prev => ({ ...prev, phase: 'closing', stage2CycleCount: stage2Cycle + 1 }));
          }
          // Phase 4 (cycle after poem2): Closing
          else if (stage2.phase === 'closing' && stage2Cycle >= 5 + stage2.payload.tips.length) {
            console.log('[Stage2] Γ£à Complete');
            setStage2(prev => ({ ...prev, phase: 'complete' }));
          } else {
            setStage2(prev => ({ ...prev, stage2CycleCount: stage2Cycle + 1 }));
          }
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isReady, cycleDuration, cycleCount, stage2Complete, stage2, onComplete]);

  // Add floating words periodically - STOP AFTER CYCLE 10
  useEffect(() => {
    if (!isReady || wordPool.current.length === 0) return;
    
    // Stop showing floating words after cycle 10
    if (cycleCount >= 10) {
      setWords([]); // Clear all existing words
      return;
    }
    
    const addWord = () => {
      const word = wordPool.current[Math.floor(Math.random() * wordPool.current.length)];
      const wordId = `word-${Date.now()}-${Math.random()}`;
      const angle = Math.random() * Math.PI * 2;
      
      setWords(prev => [...prev, { id: wordId, text: word, angle }]);
      
      setTimeout(() => {
        setWords(prev => prev.filter(w => w.id !== wordId));
      }, 5000);
    };
    
    // Add first word immediately
    addWord();
    
    const interval = setInterval(addWord, 5000);
    return () => clearInterval(interval);
  }, [isReady, cycleCount]);

  // Breathing helpers
  const isInhaling = breathProgress < 0.5;
  const skyBrightness = isInhaling ? 1.2 : 0.8;
  const leoScale = isInhaling ? 1.15 : 0.92;
  const starOpacity = isInhaling ? 0.9 : 0.3;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Sky background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: isInhaling
            ? 'linear-gradient(to bottom, #1A1734, #3B3367, #1A1734)'
            : 'linear-gradient(to bottom, #0A0714, #2B2357, #0A0714)',
        }}
        transition={{ duration: activeCycle.in, ease: EASING }}
      />
      
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80}%`,
            }}
            animate={{ opacity: starOpacity, scale: isInhaling ? 1.3 : 1 }}
            transition={{ duration: activeCycle.in, ease: EASING }}
          />
        ))}
      </div>

      {/* Leo - centered, breathing */}
      <motion.div
        className="absolute z-20 left-1/2 top-[35%]"
        style={{ x: '-50%', y: '-50%' }}
      >
        <motion.div
          animate={{ scale: leoScale }}
          transition={{ duration: activeCycle.in, ease: EASING }}
        >
          <Image src="/images/leo.svg" alt="Leo" width={200} height={200} priority />
        </motion.div>
      </motion.div>

      {/* Breathing prompt - positioned below Leo to avoid building name overlap */}
      {/* Hide when Stage 2 complete, show inhale/exhale or transition message */}
      <AnimatePresence>
        {!stage2Complete && (
          <motion.div
            className="absolute left-1/2 z-30 pointer-events-none"
            style={{
              x: '-50%',
              top: 'calc(35% + 160px)', // Below Leo
            }}
            animate={{ 
              opacity: isInhaling ? [0.3, 0.95, 0.95] : [0.95, 0.3, 0.3],
              scale: isInhaling ? [0.95, 1.08, 1.08] : [1.08, 0.92, 0.92],
            }}
            transition={{ 
              duration: activeCycle.in,
              ease: EASING,
              times: [0, 0.5, 1],
            }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
          >
            {cycleCount < 10 ? (
              // Normal breathing cues (cycles 0-9)
              <div
                className="text-4xl font-sans tracking-widest lowercase font-light"
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textShadow: `
                    0 0 20px rgba(255, 255, 255, 0.8),
                    0 0 40px rgba(255, 255, 255, 0.6),
                    0 2px 8px rgba(0,0,0,0.4)
                  `,
                  letterSpacing: '0.35em',
                }}
              >
                {isInhaling ? 'inhale' : 'exhale'}
              </div>
            ) : (
              // Transition message (cycle 10+, Stage 2 not complete)
              <div
                className="text-2xl font-serif italic tracking-wide"
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  textShadow: `
                    0 0 20px rgba(255, 255, 255, 0.6),
                    0 0 40px rgba(255, 255, 255, 0.4),
                    0 2px 8px rgba(0,0,0,0.4)
                  `,
                  letterSpacing: '0.1em',
                  fontFamily: "'DM Serif Text', serif",
                }}
              >
                your moment begins to take shape
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2 Complete: Show Poem 1 Line 1 (centered, pulsing with breath) */}
      <AnimatePresence>
        {stage2Complete && stage2.payload && (
          <motion.div
            className="absolute left-1/2 top-1/2 z-40 pointer-events-none"
            style={{
              x: '-50%',
              y: '-50%',
            }}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: isInhaling ? [0.6, 1, 1] : [1, 0.6, 0.6],
              scale: isInhaling ? [0.98, 1.05, 1.05] : [1.05, 0.95, 0.95],
            }}
            transition={{ 
              duration: activeCycle.in,
              ease: EASING,
              times: [0, 0.5, 1],
            }}
            exit={{ opacity: 0, transition: { duration: 1.5 } }}
          >
            <div
              className="text-3xl md:text-4xl font-serif italic text-center px-8 max-w-4xl"
              style={{
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: `
                  0 0 30px rgba(255, 255, 255, 0.8),
                  0 0 60px rgba(255, 255, 255, 0.5),
                  0 4px 12px rgba(0,0,0,0.5)
                `,
                letterSpacing: '0.05em',
                fontFamily: "'DM Serif Text', serif",
                lineHeight: '1.6',
              }}
            >
              {stage2.payload.poems[0]}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* City skyline with towers - primary repositioned to center-left */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-25"
        style={{ height: '50vh' }}
        initial={{ scale: 2.5, y: '-30%' }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      >
        {TOWERS.map(tower => {
          const isPrimary = tower.id === primary;
          const towerOpacity = isPrimary ? 1 : 0;
          const displayX = isPrimary ? getPrimaryTowerX(tower.id) : tower.x;
          
          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${displayX}%`,
                width: '80px',
                height: `${tower.height * 1.8}px`,
              }}
              animate={{
                opacity: towerOpacity,
                scale: isPrimary ? (isInhaling ? 1.02 : 0.98) : 1,
              }}
              transition={{ 
                opacity: { duration: isPrimary ? 0.5 : 1.5, delay: isPrimary ? 2 : 0 },
                scale: { duration: activeCycle.in, ease: EASING }
              }}
            >
              {/* Tower body */}
              <div
                className="w-full h-full relative"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  border: `1px solid ${tower.color}40`,
                  borderRadius: '2px 2px 0 0',
                }}
              >
                {/* Windows */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.floor((tower.height * 1.8) / 25) * 4 }).map((_, i) => (
                    <motion.div
                      key={`window-${tower.id}-${i}`}
                      className="rounded-[1px]"
                      animate={{
                        backgroundColor: [
                          `rgba(248, 216, 181, ${towerOpacity * 0.15})`,
                          `rgba(255, 230, 200, ${towerOpacity * 0.5})`,
                          `rgba(248, 216, 181, ${towerOpacity * 0.15})`,
                        ],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>

                {/* Building name - higher position to avoid inhale/exhale overlap */}
                {/* Hide when Stage 2 completes */}
                <AnimatePresence>
                  {isPrimary && !stage2Complete && (
                    <motion.div
                      className="absolute -top-32 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif italic text-6xl font-bold z-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 1 } }}
                      transition={{ duration: 1, delay: 2.5 }}
                      style={{
                        color: tower.color,
                        textShadow: `
                          0 0 60px ${tower.color},
                          0 0 120px ${tower.color},
                          0 0 180px ${tower.color},
                          0 0 240px ${tower.color}80,
                          0 2px 12px rgba(0,0,0,0.4)
                        `,
                      }}
                    >
                      {zoneName}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Breathing halo */}
                {isPrimary && isReady && (
                  <motion.div
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${tower.color}66 0%, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                    animate={{ scale: isInhaling ? 1.4 : 0.8 }}
                    transition={{ duration: activeCycle.in, ease: EASING }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Floating words - safe zones to avoid UI overlap */}
      <AnimatePresence>
        {words.map(word => {
          // Safe zones: avoid top 15% (auth bar), center 30-45% vertical (Leo + prompts)
          // Place words in safe horizontal bands: left (10-35%), right (65-90%)
          const angle = word.angle;
          const normalizedAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          
          // Determine safe vertical zone based on angle quadrant
          let x, y;
          
          if (normalizedAngle < Math.PI / 2) {
            // Top-right quadrant ΓåÆ place in upper-right safe zone
            x = 65 + Math.random() * 20; // 65-85%
            y = 18 + Math.random() * 10; // 18-28% (below auth bar, above Leo)
          } else if (normalizedAngle < Math.PI) {
            // Bottom-right quadrant ΓåÆ place in lower-right safe zone
            x = 65 + Math.random() * 20; // 65-85%
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else if (normalizedAngle < Math.PI * 1.5) {
            // Bottom-left quadrant ΓåÆ place in lower-left safe zone
            x = 10 + Math.random() * 20; // 10-30%
            y = 50 + Math.random() * 15; // 50-65% (below Leo, above towers)
          } else {
            // Top-left quadrant ΓåÆ place in upper-left safe zone
            x = 10 + Math.random() * 20; // 10-30%
            y = 18 + Math.random() * 10; // 18-28% (below auth bar, above Leo)
          }
          
          return (
            <motion.div
              key={word.id}
              className="absolute pointer-events-none z-40"
              style={{ left: `${x}%`, top: `${y}%` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.05, y: -20 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 6, ease: EASING }}
            >
              <span
                className="text-3xl font-serif italic font-bold"
                style={{
                  color: '#FFD700',
                  textShadow: `
                    0 0 20px #FFD700,
                    0 0 40px #FFD700,
                    0 0 60px #FFD70080,
                    0 4px 8px rgba(0,0,0,0.6)
                  `,
                }}
              >
                {word.text}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Cycle counter */}
      {cycleCount > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm font-mono">
          cycle {cycleCount} {stage2Complete && cycleCount >= MIN_CYCLES && '┬╖ ready'}
          {stage2.phase !== 'idle' && ` ┬╖ stage2: ${stage2.phase}`}
        </div>
      )}

      {/* Stage 2: Illuminated Window */}
      <AnimatePresence>
        {stage2.window && stage2.phase !== 'idle' && (
          <motion.div
            className="absolute z-40 pointer-events-none"
            style={{
              left: `${stage2.window.x}%`,
              bottom: `${stage2.window.y}%`,
              width: '160px',
              height: '120px',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: stage2.phase === 'continuity' ? 0 : 1,
              scale: stage2.phase === 'poem1' && isInhaling ? [0.8, 1.2, 1] : 1,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1, ease: EASING }}
          >
            {/* Window glow */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: `radial-gradient(circle, ${zoneColor}CC 0%, ${zoneColor}66 50%, transparent 100%)`,
                filter: 'blur(20px)',
              }}
            />
            
            {/* Window pane */}
            <div
              className="absolute inset-0 rounded-lg border-2 flex items-center justify-center p-4 overflow-hidden"
              style={{
                backgroundColor: `${zoneColor}33`,
                borderColor: `${zoneColor}99`,
                boxShadow: `
                  0 0 40px ${zoneColor}99,
                  inset 0 0 20px ${zoneColor}33
                `,
              }}
            >
              {/* Text content based on phase */}
              <AnimatePresence mode="wait">
                {/* Phase 1: Poem 1 */}
                {stage2.phase === 'poem1' && stage2.payload && (
                  <motion.div
                    key="poem1"
                    className="text-center text-white text-xs font-serif italic leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: isInhaling ? 1 : [1, 0.3],
                      y: isInhaling ? 0 : [0, -30],
                    }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ duration: activeCycle.in, ease: EASING }}
                  >
                    {stage2.payload.poems[0]}
                  </motion.div>
                )}

                {/* Phase 2: Tips (current tip) */}
                {stage2.phase === 'tips' && stage2.payload && (
                  <motion.div
                    key={`tip-${stage2.currentTipIndex}`}
                    className="text-center text-white text-xs font-sans leading-relaxed"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      // Micro-animations based on tip mood
                      y: stage2.payload.tip_moods?.[stage2.currentTipIndex] === 'peaceful'
                        ? [0, -2, 0] // Rain ripple
                        : 0,
                      x: stage2.payload.tip_moods?.[stage2.currentTipIndex] === 'celebratory'
                        ? [0, 2, -2, 0] // Rhythmic wave
                        : 0,
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      duration: stage2.payload.tip_moods?.[stage2.currentTipIndex] === 'pride'
                        ? 0.3 // Flash pulse
                        : 2,
                      repeat: stage2.payload.tip_moods?.[stage2.currentTipIndex] === 'peaceful'
                        ? Infinity
                        : 0,
                      ease: EASING,
                    }}
                  >
                    {stage2.payload.tips[stage2.currentTipIndex]}
                  </motion.div>
                )}

                {/* Phase 3: Poem 2 */}
                {stage2.phase === 'poem2' && stage2.payload && (
                  <motion.div
                    key="poem2"
                    className="text-center text-white text-xs font-serif italic leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: activeCycle.in, ease: EASING }}
                  >
                    {stage2.payload.poems[1]}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Upward glow during poem2 exhale */}
            {stage2.phase === 'poem2' && !isInhaling && (
              <motion.div
                className="absolute -top-32 left-1/2 -translate-x-1/2 w-32 h-32"
                style={{
                  background: `radial-gradient(circle, ${zoneColor}66 0%, transparent 70%)`,
                  filter: 'blur(30px)',
                }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 0.8, 0], y: -60 }}
                transition={{ duration: activeCycle.out, ease: EASING }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2: Phase 0 - Continuity text */}
      <AnimatePresence>
        {stage2.phase === 'continuity' && !isInhaling && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 1, 1], y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: activeCycle.out, ease: EASING, times: [0, 0.3, 1] }}
          >
            <p className="text-white/80 text-2xl font-serif italic text-center max-w-md">
              Your moment begins to take shape...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2: Phase 4 - Closing cue */}
      <AnimatePresence>
        {stage2.phase === 'closing' && stage2.payload && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 2, ease: EASING }}
          >
            {/* Sticky note icon */}
            <motion.div
              className="text-6xl"
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
              ≡ƒô¥
            </motion.div>

            {/* Closing text */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 max-w-lg text-center">
              <p className="text-white text-lg font-serif italic leading-relaxed mb-2">
                If anything came to mind, write it down and feed it to {pigName}.
              </p>
              {stage2.payload.closing_line && (
                <p className="text-white/70 text-sm font-sans mt-4">
                  {stage2.payload.closing_line}
                </p>
              )}
            </div>

            {/* Leo turns slightly */}
            <motion.div
              className="absolute -top-64 left-0"
              animate={{ rotate: [0, 15, 0] }}
              transition={{ duration: 4, ease: 'easeInOut' }}
            >
              <Image src="/images/leo.svg" alt="Leo" width={120} height={120} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


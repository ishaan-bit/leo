'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InterludeVisuals from './InterludeVisuals';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';

/**
 * InterludeFlow - Orchestrates the "Held Safe → Interlude → Ready" experience
 * 
 * State Machine:
 * 1. held_safe (2-3s) - "Your moment has been held safe"
 * 2. interlude_active (variable) - Cinematic waiting with sparkles, glow, breathing
 * 3. complete_transition (2s) - "Your moment is ready"
 * 4. progress_ready - Flow complete, trigger onComplete callback
 * 
 * Timing Rules:
 * - Minimum total dwell: 8s (even if enrichment finishes early)
 * - Soft timeout: 90s (show reassurance)
 * - Hard timeout: 150s (offer background completion)
 * - Maximum: 3 minutes absolute cap
 * 
 * Accessibility:
 * - Respects prefers-reduced-motion
 * - Respects prefers-reduced-transparency
 * - Skip control appears after 12s
 * - All sensory cues have text alternatives
 */

type InterludePhase = 'held_safe' | 'interlude_active' | 'complete_transition' | 'progress_ready';

interface InterludeFlowProps {
  reflectionId: string;
  pigName: string;
  onComplete: () => void;
  onTimeout?: () => void;
  onSkip?: () => void;
}

// Copy pools for each phase - poetic, whisper-like
const COPY = {
  heldSafe: {
    line1: 'Your moment has been held safe.',
    delay: 1500, // 1.5s delay before showing
  },
  interlude: [
    'A quiet breath between things.',
    'Time holding its breath.',
    'The soft space after speaking.',
    'Letting it settle.',
    'A pause, like wind through leaves.',
    'Stillness carries weight too.',
  ],
  reassurance: [
    'Still here with you…',
    'Taking a little longer…',
    'Staying with it…',
  ],
  complete: {
    line1: 'Your moment is ready.',
    duration: 2000,
  },
  timeout: {
    message: "We'll finish in the background.",
    action: 'You can return later.',
  },
};

const TIMING = {
  HELD_SAFE_DURATION: 2500,           // 2.5s
  COMPLETE_TRANSITION_DURATION: 2000, // 2s
  MINIMUM_TOTAL_DWELL: 8000,          // 8s minimum experience
  SHOW_SKIP_AFTER: 12000,             // 12s before showing skip
  SOFT_TIMEOUT: 90000,                // 90s soft timeout
  HARD_TIMEOUT: 150000,               // 150s hard timeout
  ABSOLUTE_CAP: 180000,               // 3 minutes max
  COPY_ROTATION_INTERVAL: 10000,      // 10s between copy rotations
};

export default function InterludeFlow({
  reflectionId,
  pigName,
  onComplete,
  onTimeout,
  onSkip,
}: InterludeFlowProps) {
  const [phase, setPhase] = useState<InterludePhase>('held_safe');
  const [currentCopy, setCurrentCopy] = useState<string>(COPY.heldSafe.line1);
  const [showSkip, setShowSkip] = useState(false);
  const [showReassurance, setShowReassurance] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  
  const startTimeRef = useRef(Date.now());
  const minimumDwellMetRef = useRef(false);
  const copyRotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check for accessibility preferences
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  
  // Poll enrichment status
  const { 
    isReady, 
    isLoading, 
    error,
    elapsedTime 
  } = useEnrichmentStatus(reflectionId, {
    enabled: phase === 'interlude_active',
    pollInterval: 3500, // 3.5s with jitter
    onTimeout: () => {
      if (onTimeout) {
        onTimeout();
      }
    },
  });
  
  // Phase 1: Held Safe → Interlude
  useEffect(() => {
    if (phase === 'held_safe') {
      const timer = setTimeout(() => {
        setPhase('interlude_active');
        setCurrentCopy(COPY.interlude[0]);
        
        // Start copy rotation
        startCopyRotation();
        
        // Track telemetry
        logTelemetry('interlude_started', {
          reflectionId,
          timestamp: Date.now(),
          reduceMotion: prefersReducedMotion,
        });
      }, TIMING.HELD_SAFE_DURATION);
      
      return () => clearTimeout(timer);
    }
  }, [phase, reflectionId, prefersReducedMotion]);
  
  // Show skip button after delay
  useEffect(() => {
    if (phase === 'interlude_active') {
      const timer = setTimeout(() => {
        setShowSkip(true);
      }, TIMING.SHOW_SKIP_AFTER);
      
      return () => clearTimeout(timer);
    }
  }, [phase]);
  
  // Check for minimum dwell time
  useEffect(() => {
    if (phase === 'interlude_active') {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed >= TIMING.MINIMUM_TOTAL_DWELL) {
          minimumDwellMetRef.current = true;
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
  }, [phase]);
  
  // Show reassurance at soft timeout
  useEffect(() => {
    if (phase === 'interlude_active' && elapsedTime >= TIMING.SOFT_TIMEOUT) {
      setShowReassurance(true);
      setCurrentCopy(COPY.reassurance[0]);
    }
  }, [phase, elapsedTime]);
  
  // Absolute timeout at hard limit
  useEffect(() => {
    if (phase === 'interlude_active' && elapsedTime >= TIMING.HARD_TIMEOUT) {
      handleTimeout();
    }
  }, [phase, elapsedTime]);
  
  // Enrichment ready → transition to complete
  useEffect(() => {
    if (isReady && phase === 'interlude_active') {
      // Wait for minimum dwell if not met yet
      if (!minimumDwellMetRef.current) {
        const remainingTime = TIMING.MINIMUM_TOTAL_DWELL - (Date.now() - startTimeRef.current);
        if (remainingTime > 0) {
          setTimeout(() => {
            transitionToComplete();
          }, remainingTime);
          return;
        }
      }
      
      transitionToComplete();
    }
  }, [isReady, phase]);
  
  // Phase 3: Complete Transition → Ready
  useEffect(() => {
    if (phase === 'complete_transition') {
      const timer = setTimeout(() => {
        setPhase('progress_ready');
        
        // Track telemetry
        const totalDuration = Date.now() - startTimeRef.current;
        logTelemetry('interlude_completed', {
          reflectionId,
          duration: totalDuration,
          enrichmentTime: elapsedTime,
          skipped: false,
        });
        
        // Trigger completion callback
        onComplete();
      }, TIMING.COMPLETE_TRANSITION_DURATION);
      
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete, reflectionId, elapsedTime]);
  
  // Copy rotation system
  const startCopyRotation = () => {
    let index = 0;
    
    copyRotationTimerRef.current = setInterval(() => {
      index = (index + 1) % COPY.interlude.length;
      setCopyIndex(index);
      setCurrentCopy(COPY.interlude[index]);
    }, TIMING.COPY_ROTATION_INTERVAL);
  };
  
  // Cleanup copy rotation
  useEffect(() => {
    return () => {
      if (copyRotationTimerRef.current) {
        clearInterval(copyRotationTimerRef.current);
      }
    };
  }, []);
  
  const transitionToComplete = () => {
    // Stop copy rotation
    if (copyRotationTimerRef.current) {
      clearInterval(copyRotationTimerRef.current);
    }
    
    setPhase('complete_transition');
    setCurrentCopy(COPY.complete.line1);
    setShowSkip(false);
  };
  
  const handleSkip = () => {
    if (copyRotationTimerRef.current) {
      clearInterval(copyRotationTimerRef.current);
    }
    
    const totalDuration = Date.now() - startTimeRef.current;
    logTelemetry('interlude_skipped', {
      reflectionId,
      duration: totalDuration,
      enrichmentTime: elapsedTime,
    });
    
    if (onSkip) {
      onSkip();
    }
    
    // If enrichment is ready, go to complete; otherwise show text-only progress
    if (isReady) {
      transitionToComplete();
    } else {
      setCurrentCopy('Continuing in the background…');
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };
  
  const handleTimeout = () => {
    if (copyRotationTimerRef.current) {
      clearInterval(copyRotationTimerRef.current);
    }
    
    logTelemetry('interlude_timeout', {
      reflectionId,
      duration: TIMING.HARD_TIMEOUT,
    });
    
    setCurrentCopy(COPY.timeout.message);
    
    setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      } else {
        onComplete();
      }
    }, 3000);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100 overflow-hidden">
      {/* Interlude Visuals */}
      <InterludeVisuals
        phase={phase}
        pigName={pigName}
        reduceMotion={prefersReducedMotion}
      />
      
      {/* Copy Display */}
      <div className="relative z-20 flex flex-col items-center justify-center space-y-8 px-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {phase === 'held_safe' && (
            <motion.div
              key="held-safe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 1.5, 
                delay: COPY.heldSafe.delay / 1000, // Convert ms to s
                ease: [0.4, 0, 0.2, 1] // easeInOutCirc 
              }}
              className="text-center"
            >
              <p className="text-2xl md:text-3xl font-serif italic text-[#7D2054] tracking-wider leading-relaxed">
                {COPY.heldSafe.line1}
              </p>
            </motion.div>
          )}
          
          {(phase === 'interlude_active' || phase === 'complete_transition') && (
            <motion.div
              key={`copy-${currentCopy}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              className="text-center"
            >
              <p className="text-2xl md:text-3xl font-serif italic text-[#7D2054] tracking-wide leading-relaxed">
                {currentCopy}
              </p>
              
              {showReassurance && phase === 'interlude_active' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-sm text-pink-600 italic"
                >
                  {COPY.reassurance[1]}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Skip Button */}
        <AnimatePresence>
          {showSkip && phase === 'interlude_active' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleSkip}
              className="mt-8 px-6 py-2 text-sm text-pink-600 hover:text-pink-800 
                         border border-pink-300 rounded-full hover:border-pink-400 
                         transition-colors duration-200 backdrop-blur-sm bg-white/30"
              aria-label="Skip interlude"
            >
              Skip interlude
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      {/* Progress indicator (accessibility) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {phase === 'interlude_active' && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex gap-1"
            role="status"
            aria-live="polite"
            aria-label="Processing your reflection"
          >
            <span className="w-2 h-2 bg-pink-400 rounded-full" />
            <span className="w-2 h-2 bg-pink-400 rounded-full" style={{ animationDelay: '0.2s' }} />
            <span className="w-2 h-2 bg-pink-400 rounded-full" style={{ animationDelay: '0.4s' }} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Telemetry helper
function logTelemetry(event: string, data: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event, data);
  }
  
  // Also log to console in dev
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Interlude Telemetry] ${event}`, data);
  }
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn } from 'next-auth/react';
import PinkPig from '../molecules/PinkPig';
import NotebookInput from '../atoms/NotebookInput';
import VoiceOrb from '../atoms/VoiceOrb';
import AuthStateIndicator from '../atoms/AuthStateIndicator';
import type { ProcessedText } from '@/lib/multilingual/textProcessor';
import type { TypingMetrics, VoiceMetrics, AffectVector } from '@/lib/behavioral/metrics';
import { composeAffectFromTyping, composeAffectFromVoice } from '@/lib/behavioral/metrics';
import { getAdaptiveAmbientSystem } from '@/lib/audio/AdaptiveAmbientSystem';
import { getTimeOfDay, getTimeTheme, getTimeBasedGreeting } from '@/lib/time-theme';
import { generateHeartPuff, breathingAnimation, exhaleAnimation } from '@/lib/pig-animations';
import dialogueData from '@/lib/copy/reflect.dialogue.json';

interface Scene_ReflectProps {
  pigId: string;
  pigName: string;
}

type SessionVariant = 'first' | 'returning' | 'longGap';
type InputMode = 'notebook' | 'voice';

export default function Scene_Reflect({ pigId, pigName }: Scene_ReflectProps) {
  const { data: session, status } = useSession();
  const [sessionVariant, setSessionVariant] = useState<SessionVariant>('first');
  const [inputMode, setInputMode] = useState<InputMode>('notebook');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showGuestNudge, setShowGuestNudge] = useState(false);
  
  // Scene state
  const [currentAffect, setCurrentAffect] = useState<AffectVector>({
    arousal: 0.5,
    valence: 0,
    cognitiveEffort: 0.5,
  });
  const [dialogue, setDialogue] = useState<string>('');
  const [scenePhase, setScenePhase] = useState<'entering' | 'listening' | 'completing'>('entering');
  
  // Visual state
  const [particleCount, setParticleCount] = useState(60);
  const [backgroundTone, setBackgroundTone] = useState('from-pink-50 to-rose-100');
  const [pigMood, setPigMood] = useState<'calm' | 'curious' | 'happy' | 'listening'>('calm');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [heartPuffs, setHeartPuffs] = useState<Array<{ x: number; y: number; rotation: number; delay: number }>>([]);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const audioSystemRef = useRef(getAdaptiveAmbientSystem());
  const sceneStartTime = useRef(Date.now());
  const pigRef = useRef<HTMLDivElement>(null);
  const [soundMuted, setSoundMuted] = useState(false);

  // Detect session variant
  useEffect(() => {
    const lastVisit = localStorage.getItem('leo.reflect.lastVisit');
    
    if (!lastVisit) {
      setSessionVariant('first');
    } else {
      const daysSinceLastVisit = (Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastVisit > 7) {
        setSessionVariant('longGap');
      } else {
        setSessionVariant('returning');
      }
    }
  }, []);

  // Initialize audio system
  useEffect(() => {
    audioSystemRef.current.init();
    
    return () => {
      audioSystemRef.current.stop();
    };
  }, []);

  // Set up time-based theme
  useEffect(() => {
    const updateTimeTheme = () => {
      const timeOfDay = getTimeOfDay();
      const theme = getTimeTheme(timeOfDay);
      
      setBackgroundTone(theme.background);
      setParticleCount(theme.particles.count);
    };
    
    // Update immediately
    updateTimeTheme();
    
    // Update every 30 seconds to catch time changes
    const interval = setInterval(updateTimeTheme, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Track mouse position for pig eye following
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Set initial dialogue based on time of day
  useEffect(() => {
    const timeGreeting = getTimeBasedGreeting(pigName);
    setDialogue(timeGreeting);
  }, [pigName]);

  // Show guest nudge on first keystroke for non-authenticated users
  useEffect(() => {
    // No timer - will trigger contextually in handleTextChange
  }, [status]);

  // Check for reduced motion preference
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setParticleCount(20);
    }
  }, []);

  // Handle text input change (real-time affect updates)
  const handleTextChange = (text: string, metrics: TypingMetrics) => {
    // Show contextual sign-in nudge on first keystroke (guest users only)
    if (status === 'unauthenticated' && text.length === 1 && !showGuestNudge) {
      setShowGuestNudge(true);
    }
    
    if (scenePhase === 'entering') {
      setScenePhase('listening');
      
      // Update dialogue to "listening" state
      const typingDialogue = dialogueData.typing.start[Math.floor(Math.random() * dialogueData.typing.start.length)];
      setDialogue(typingDialogue.replace('{pigName}', pigName));
    }
    
    // Calculate affect from typing
    const affect = composeAffectFromTyping(metrics);
    setCurrentAffect(affect);
    
    // Update audio system
    audioSystemRef.current.updateFromAffect(affect);
    
    // Play ink ripple sound
    audioSystemRef.current.playInkRipple();
    
    // Update pig mood based on typing intensity
    if (affect.arousal > 0.7) {
      setPigMood('curious');
    } else if (affect.valence > 0.3) {
      setPigMood('happy');
    } else {
      setPigMood('calm');
    }
  };

  // Handle text submission
  const handleTextSubmit = async (processed: ProcessedText, metrics: TypingMetrics) => {
    setIsSubmitting(true);
    setScenePhase('completing');
    
    const affect = composeAffectFromTyping(metrics);
    
    // Trigger heart puff animation
    setHeartPuffs(generateHeartPuff(6));
    setShowHeartAnimation(true);
    setPigMood('happy');
    
    // Play completion chime
    audioSystemRef.current.playChime();
    
    // Show completion dialogue
    const completionDialogue = dialogueData.completion.success[
      Math.floor(Math.random() * dialogueData.completion.success.length)
    ];
    setDialogue(completionDialogue.replace('{pigName}', pigName));
    
    // Clear heart animation after delay
    setTimeout(() => setShowHeartAnimation(false), 2000);
    
    // Save reflection
    await saveReflection({
      pigId,
      inputType: 'notebook',
      originalText: processed.original,
      normalizedText: processed.normalized,
      detectedLanguage: processed.detectedLanguage,
      affect,
      metrics: {
        typing: metrics,
      },
    });
    
    // Update last visit
    localStorage.setItem('leo.reflect.lastVisit', Date.now().toString());
    
    // Show completion state
    setShowCompletion(true);
    
    setTimeout(() => {
      setIsSubmitting(false);
    }, 3000);
  };

  // Handle voice submission
  const handleVoiceSubmit = async (processed: ProcessedText, metrics: VoiceMetrics) => {
    setIsSubmitting(true);
    setScenePhase('completing');
    
    const affect = composeAffectFromVoice(metrics);
    
    // Trigger heart puff animation
    setHeartPuffs(generateHeartPuff(6));
    setShowHeartAnimation(true);
    setPigMood('happy');
    
    // Play completion chime
    audioSystemRef.current.playChime();
    
    // Show completion dialogue
    const completionDialogue = dialogueData.completion.success[
      Math.floor(Math.random() * dialogueData.completion.success.length)
    ];
    setDialogue(completionDialogue.replace('{pigName}', pigName));
    
    // Clear heart animation after delay
    setTimeout(() => setShowHeartAnimation(false), 2000);
    
    // Save reflection
    await saveReflection({
      pigId,
      inputType: 'voice',
      originalText: processed.original,
      normalizedText: processed.normalized,
      detectedLanguage: processed.detectedLanguage,
      affect,
      metrics: {
        voice: metrics,
      },
    });
    
    // Update last visit
    localStorage.setItem('leo.reflect.lastVisit', Date.now().toString());
    
    // Show completion state
    setShowCompletion(true);
    
    setTimeout(() => {
      setIsSubmitting(false);
    }, 3000);
  };

  // Save reflection to backend
  const saveReflection = async (data: any) => {
    try {
      const response = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          userId: (session?.user as any)?.id || null,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save reflection');
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
      const errorDialogue = dialogueData.completion.error[0];
      setDialogue(errorDialogue);
    }
  };

  // Switch input mode
  const toggleInputMode = () => {
    setInputMode(prev => prev === 'notebook' ? 'voice' : 'notebook');
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${backgroundTone} relative overflow-hidden transition-colors duration-1000`}>
      {/* Breathing background gradient overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(circle at 30% 50%, rgba(251, 207, 232, 0.15), transparent 60%)',
            'radial-gradient(circle at 70% 50%, rgba(251, 207, 232, 0.2), transparent 60%)',
            'radial-gradient(circle at 30% 50%, rgba(251, 207, 232, 0.15), transparent 60%)',
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Sound toggle - top left */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        onClick={() => {
          setSoundMuted(!soundMuted);
          localStorage.setItem('leo.sound.muted', String(!soundMuted));
          // TODO: Implement actual mute/unmute when sound system supports it
        }}
        className="fixed top-6 left-6 z-30 w-12 h-12 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-300 flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title={soundMuted ? "Unmute sound" : "Mute sound"}
      >
        <span className="text-xl">{soundMuted ? '🔇' : '🔊'}</span>
      </motion.button>
      
      {/* Auth state indicator - top right */}
      <AuthStateIndicator 
        userName={session?.user?.name}
        isGuest={status === 'unauthenticated'}
      />
      
      {/* Atmospheric particles with time-based colors */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: particleCount }).map((_, i) => {
          const timeTheme = getTimeTheme(getTimeOfDay());
          const colorClass = timeTheme.particles.colors[i % timeTheme.particles.colors.length];
          
          return (
            <motion.div
              key={i}
              className={`absolute w-1 h-1 ${colorClass} rounded-full`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </div>
      
      {/* Heart puff animation on submit */}
      {showHeartAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {heartPuffs.map((puff, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl"
              initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
              animate={{
                x: puff.x,
                y: puff.y,
                opacity: 0,
                scale: [0, 1.2, 0.8],
                rotate: puff.rotation,
              }}
              transition={{
                duration: 1.5,
                delay: puff.delay,
                ease: 'easeOut',
              }}
            >
              💖
            </motion.div>
          ))}
        </div>
      )}

      {/* Main content - centered vertically with reduced top padding */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-4 md:py-8">
        {/* Pig avatar with breathing and typing reaction - positioned above text */}
        <motion.div
          ref={pigRef}
          initial={{ opacity: 0, y: 20 }}
          animate={
            showHeartAnimation 
              ? 'exhale' 
              : scenePhase === 'listening'
              ? 'leanIn'
              : 'breathing'
          }
          variants={{
            ...breathingAnimation,
            ...exhaleAnimation,
            leanIn: {
              y: [0, 5, 0],
              scale: [1, 1.05, 1],
              transition: {
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            },
          }}
          className="relative mb-6"
        >
          <PinkPig 
            size={160} 
            className={pigMood === 'curious' ? 'animate-pulse' : ''}
          />
          
          {/* Ambient glow around pig - intensifies when listening */}
          <motion.div
            className="absolute inset-0 -z-10 rounded-full blur-3xl"
            style={{
              background: getTimeTheme(getTimeOfDay()).ambientLight,
            }}
            animate={{
              scale: scenePhase === 'listening' ? [1, 1.3, 1] : [1, 1.2, 1],
              opacity: scenePhase === 'listening' ? [0.4, 0.7, 0.4] : [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.div>

        {/* Dialogue - darker text with word-by-word fade-in */}
        <motion.div
          key={dialogue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-8 text-center max-w-lg"
        >
          <p className="text-xl md:text-2xl font-serif italic text-[#9C1F5F] leading-relaxed">
            {dialogue.split(' ').map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.08,
                  ease: 'easeOut',
                }}
                className="inline-block mr-[0.3em]"
              >
                {word}
              </motion.span>
            ))}
          </p>
        </motion.div>

        {/* Input area */}
        <AnimatePresence mode="wait">
          {!showCompletion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl"
            >
              {inputMode === 'notebook' ? (
                <NotebookInput
                  onTextChange={handleTextChange}
                  onSubmit={handleTextSubmit}
                  disabled={isSubmitting}
                />
              ) : (
                <VoiceOrb
                  onTranscript={handleVoiceSubmit}
                  disabled={isSubmitting}
                />
              )}
              
              {/* Mode toggle */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={toggleInputMode}
                  className="text-sm text-pink-600 hover:text-pink-800 italic underline"
                >
                  {inputMode === 'notebook' ? 'Or speak instead' : 'Or write instead'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion state */}
        <AnimatePresence>
          {showCompletion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="text-6xl mb-4"
              >
                ✨
              </motion.div>
              <p className="text-lg font-serif italic text-pink-800">
                Your reflection has been held safe.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guest nudge */}
        <AnimatePresence>
          {showGuestNudge && status === 'unauthenticated' && !showCompletion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-xl border border-pink-200"
            >
              <p className="text-sm font-serif text-pink-800 mb-2">
                {dialogueData.guestNudge.copy.replace('{pigName}', pigName)}
              </p>
              <button
                onClick={() => signIn('google')}
                className="w-full bg-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
              >
                {dialogueData.guestNudge.button}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

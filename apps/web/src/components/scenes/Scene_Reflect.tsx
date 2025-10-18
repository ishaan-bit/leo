'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn } from 'next-auth/react';
import PinkPig from '../molecules/PinkPig';
import NotebookInput from '../atoms/NotebookInput';
import VoiceOrb from '../atoms/VoiceOrb';
import type { ProcessedText } from '@/lib/multilingual/textProcessor';
import type { TypingMetrics, VoiceMetrics, AffectVector } from '@/lib/behavioral/metrics';
import { composeAffectFromTyping, composeAffectFromVoice } from '@/lib/behavioral/metrics';
import { getAdaptiveAmbientSystem } from '@/lib/audio/AdaptiveAmbientSystem';
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
  const [pigMood, setPigMood] = useState<'calm' | 'curious' | 'happy'>('calm');
  
  const audioSystemRef = useRef(getAdaptiveAmbientSystem());
  const sceneStartTime = useRef(Date.now());

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

  // Set initial dialogue based on variant
  useEffect(() => {
    const variantDialogue = dialogueData.variants[sessionVariant];
    const intro = variantDialogue.intro[Math.floor(Math.random() * variantDialogue.intro.length)];
    setDialogue(intro.replace('{pigName}', pigName));
    
    // Update visuals based on variant
    const visuals = variantDialogue.visuals;
    if (visuals.tone === 'gold') {
      setBackgroundTone('from-amber-50 via-rose-50 to-pink-100');
    } else if (visuals.tone === 'lilac') {
      setBackgroundTone('from-purple-50 via-pink-50 to-rose-100');
    } else if (visuals.tone === 'indigo') {
      setBackgroundTone('from-indigo-50 via-purple-50 to-pink-100');
    }
  }, [sessionVariant, pigName]);

  // Show guest nudge after 15 seconds for non-authenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      const timer = setTimeout(() => {
        setShowGuestNudge(true);
      }, 15000);
      
      return () => clearTimeout(timer);
    }
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
    
    // Update pig mood
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
    
    // Play completion chime
    audioSystemRef.current.playChime();
    
    // Show completion dialogue
    const completionDialogue = dialogueData.completion.success[
      Math.floor(Math.random() * dialogueData.completion.success.length)
    ];
    setDialogue(completionDialogue.replace('{pigName}', pigName));
    
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
    
    // Play completion chime
    audioSystemRef.current.playChime();
    
    // Show completion dialogue
    const completionDialogue = dialogueData.completion.success[
      Math.floor(Math.random() * dialogueData.completion.success.length)
    ];
    setDialogue(completionDialogue.replace('{pigName}', pigName));
    
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
    <div className={`min-h-screen bg-gradient-to-br ${backgroundTone} relative overflow-hidden`}>
      {/* Atmospheric particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: particleCount }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-pink-300/30 rounded-full"
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
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Pig avatar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="mb-8"
        >
          <PinkPig size={180} className={pigMood === 'curious' ? 'animate-bounce' : ''} />
        </motion.div>

        {/* Dialogue */}
        <motion.div
          key={dialogue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-12 text-center max-w-lg"
        >
          <p className="text-xl font-serif italic text-pink-800">
            {dialogue}
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

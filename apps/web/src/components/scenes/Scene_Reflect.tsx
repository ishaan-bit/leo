'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn } from 'next-auth/react';
import PinkPig from '../molecules/PinkPig';
import NotebookInput from '../atoms/NotebookInput';
import VoiceOrb from '../atoms/VoiceOrb';
import AuthStateIndicator from '../atoms/AuthStateIndicator';
import SoundToggle from '../atoms/SoundToggle';
import CityInterlude from '../organisms/CityInterlude';
import type { ProcessedText } from '@/lib/multilingual/textProcessor';
import type { TypingMetrics, VoiceMetrics, AffectVector } from '@/lib/behavioral/metrics';
import { composeAffectFromTyping, composeAffectFromVoice } from '@/lib/behavioral/metrics';
import { getAdaptiveAmbientSystem } from '@/lib/audio/AdaptiveAmbientSystem';
import { getTimeOfDay, getTimeTheme, getTimeBasedGreeting } from '@/lib/time-theme';
import { generateHeartPuff } from '@/lib/pig-animations';
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
  const [showInterlude, setShowInterlude] = useState(false);
  const [currentReflectionId, setCurrentReflectionId] = useState<string | null>(null);
  const [showGuestNudge, setShowGuestNudge] = useState(false);
  const [guestNudgeMinimized, setGuestNudgeMinimized] = useState(false);
  
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
  const [wordCount, setWordCount] = useState(0); // Track word count for blush intensity
  
  const audioSystemRef = useRef(getAdaptiveAmbientSystem());
  const sceneStartTime = useRef(Date.now());
  const pigRef = useRef<HTMLDivElement>(null);

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
    // Auto-minimize guest nudge after 5 seconds if shown
    if (showGuestNudge && !guestNudgeMinimized) {
      const minimizeTimer = setTimeout(() => {
        setGuestNudgeMinimized(true);
      }, 5000); // Minimize after 5 seconds
      
      return () => clearTimeout(minimizeTimer);
    }
  }, [showGuestNudge, guestNudgeMinimized]);

  // Check for reduced motion preference
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setParticleCount(20);
    }
  }, []);

  // Handle text input change (real-time affect updates)
  const handleTextChange = (text: string, metrics: TypingMetrics) => {
    // Update word count for blush intensity
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
    
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
    const reflectionId = await saveReflection({
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
    
    // Start interlude flow
    if (reflectionId) {
      console.log('[Scene_Reflect] Reflection saved with ID:', reflectionId);
      setCurrentReflectionId(reflectionId);
      
      // Small delay before showing interlude (let heart animation finish)
      setTimeout(() => {
        console.log('[Scene_Reflect] Showing CityInterlude');
        setIsSubmitting(false);
        setShowInterlude(true);
      }, 1500);
    } else {
      console.warn('[Scene_Reflect] No reflection ID returned from save');
      // Fallback if no reflection ID
      setTimeout(() => {
        setIsSubmitting(false);
      }, 3000);
    }
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
    const reflectionId = await saveReflection({
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
    
    // Start interlude flow
    if (reflectionId) {
      console.log('[Scene_Reflect] Reflection saved with ID (voice):', reflectionId);
      setCurrentReflectionId(reflectionId);
      
      // Small delay before showing interlude
      setTimeout(() => {
        console.log('[Scene_Reflect] Showing CityInterlude (voice)');
        setIsSubmitting(false);
        setShowInterlude(true);
      }, 1500);
    } else {
      console.warn('[Scene_Reflect] No reflection ID returned from save (voice)');
      setTimeout(() => {
        setIsSubmitting(false);
      }, 3000);
    }
  };

  // Save reflection to backend
  const saveReflection = async (data: any): Promise<string | null> => {
    try {
      // Get device info
      const getDeviceInfo = () => {
        const ua = navigator.userAgent;
        let platform = 'unknown';
        if (/android/i.test(ua)) platform = 'Android';
        else if (/iPad|iPhone|iPod/.test(ua)) platform = 'iOS';
        else if (/Win/.test(ua)) platform = 'Windows';
        else if (/Mac/.test(ua)) platform = 'macOS';
        else if (/Linux/.test(ua)) platform = 'Linux';
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
        let type = 'desktop';
        if (isTablet) type = 'tablet';
        else if (isMobile) type = 'mobile';
        
        return {
          type,
          platform,
          locale: navigator.language || 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      };
      
      const response = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          pigName, // Include pig name from props
          deviceInfo: getDeviceInfo(),
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save reflection');
      }
      
      const result = await response.json();
      console.log('[Scene_Reflect] Save response:', result);
      // API returns data.reflectionId or rid for backwards compatibility
      return result.data?.reflectionId || result.rid || null;
    } catch (error) {
      console.error('Error saving reflection:', error);
      const errorDialogue = dialogueData.completion.error[0];
      setDialogue(errorDialogue);
      return null;
    }
  };

  // Switch input mode
  const toggleInputMode = () => {
    setInputMode(prev => prev === 'notebook' ? 'voice' : 'notebook');
  };

  // Handle interlude completion
  const handleInterludeComplete = (primaryEmotion: string) => {
    // TODO: Navigate to progression view or show enriched results
    console.log('[Scene_Reflect] Interlude complete, primary emotion:', primaryEmotion);
    
    // For now, reset to allow another reflection
    setShowInterlude(false);
    setCurrentReflectionId(null);
    setScenePhase('entering');
    
    // Reset dialogue
    const timeGreeting = getTimeBasedGreeting(pigName);
    setDialogue(timeGreeting);
  };

  const handleInterludeTimeout = () => {
    console.log('[Scene_Reflect] Enrichment timeout, continuing in background');
    
    // Reset to allow another reflection
    setShowInterlude(false);
    setCurrentReflectionId(null);
    setScenePhase('entering');
    
    const timeGreeting = getTimeBasedGreeting(pigName);
    setDialogue(timeGreeting);
  };

  // DEBUG: Log state before conditional check
  console.log('[Scene_Reflect] Render check:', { showInterlude, currentReflectionId, isSubmitting, scenePhase });
  
  // If showing interlude, render it as overlay
  if (showInterlude && currentReflectionId) {
    console.log('[Scene_Reflect] ✅ Rendering CityInterlude with reflectionId:', currentReflectionId);
    return (
      <CityInterlude
        reflectionId={currentReflectionId}
        pigName={pigName}
        onComplete={handleInterludeComplete}
        onTimeout={handleInterludeTimeout}
      />
    );
  }

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
      
      {/* Top bar: Auth state centered */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-center px-6 py-4 pointer-events-none"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
          paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
        }}
      >
        {/* Auth state indicator - centered */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="pointer-events-auto"
        >
          <AuthStateIndicator 
            userName={session?.user?.name}
            isGuest={status === 'unauthenticated'}
          />
        </motion.div>
      </div>
      
      {/* Sound toggle - rendered separately, positions itself with fixed */}
      <SoundToggle />
      
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
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-4 md:py-8 pt-24">
        {/* Pig avatar - SIMPLE, just like naming page */}
        <div ref={pigRef} className="mb-8">
          <PinkPig 
            size={240} 
            state={scenePhase === 'listening' ? 'thinking' : (showHeartAnimation ? 'happy' : 'idle')}
            onInputFocus={scenePhase === 'listening'}
            wordCount={wordCount}
          />
        </div>

        {/* Dialogue - poetic typography with word-by-word fade-in */}
        <motion.div
          key={dialogue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-10 text-center max-w-lg px-4"
        >
          <p 
            className="text-2xl md:text-3xl font-serif italic text-[#9C1F5F] leading-snug tracking-wide"
            style={{ 
              fontFamily: "'DM Serif Text', serif",
              lineHeight: '1.4',
              letterSpacing: '0.01em'
            }}
          >
            {dialogue.split(' ').map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.35,
                  delay: index * 0.08,
                  ease: 'easeOut',
                }}
                className="inline-block mr-[0.35em]"
              >
                {word}
              </motion.span>
            ))}
          </p>
        </motion.div>

        {/* Input area */}
        <AnimatePresence mode="wait">
          {!isSubmitting && (
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
                  placeholder={`Dear ${pigName}...`}
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

        {/* Guest nudge */}
        <AnimatePresence>
          {showGuestNudge && status === 'unauthenticated' && !isSubmitting && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: guestNudgeMinimized ? 0.85 : 1,
              }}
              exit={{ opacity: 0, y: 20 }}
              className={`fixed ${guestNudgeMinimized ? 'bottom-4 right-4' : 'bottom-8 left-1/2 -translate-x-1/2'} 
                bg-white/90 backdrop-blur-sm rounded-full shadow-xl border border-pink-200 
                transition-all duration-500`}
              style={{
                padding: guestNudgeMinimized ? '0.75rem 1rem' : '1.5rem',
                maxWidth: guestNudgeMinimized ? '280px' : '400px',
              }}
              onClick={() => !guestNudgeMinimized && setGuestNudgeMinimized(false)}
            >
              {guestNudgeMinimized ? (
                // Minimized state - compact
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 text-xs font-serif text-pink-800 hover:text-pink-900"
                >
                  <span>💾</span>
                  <span>Save reflections?</span>
                </button>
              ) : (
                // Full state
                <>
                  <p className="text-sm font-serif text-pink-800 mb-2">
                    {dialogueData.guestNudge.copy.replace('{pigName}', pigName)}
                  </p>
                  <button
                    onClick={() => signIn('google')}
                    className="w-full bg-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
                  >
                    {dialogueData.guestNudge.button}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

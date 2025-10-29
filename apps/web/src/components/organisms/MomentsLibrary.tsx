'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { getZone, type PrimaryEmotion } from '@/lib/zones';
import { translateToHindi } from '@/lib/translation';

interface Moment {
  id: string;
  text: string;
  zone: PrimaryEmotion;
  primaryEmotion: string;
  secondary: string;
  tertiary: string;
  timestamp: string;
  invoked: string;
  expressed: string;
  poems: string[];
  tips: string[];
  closingLine: string;
  valence: number;
  arousal: number;
  image_base64?: string; // Optional Base64-encoded image (raw string, no data URL prefix)
  pig_name?: string; // Optional pig name for personalized sharing
  songs?: {
    en: {
      title: string;
      artist: string;
      year: number;
      youtube_url: string;
      why: string;
    };
    hi: {
      title: string;
      artist: string;
      year: number;
      youtube_url: string;
      why: string;
    };
  };
}

interface TranslatedMoment {
  text: string;
  invoked: string;
  expressed: string;
  poems: string[];
  tips: string[];
  closingLine: string;
}

interface MomentsLibraryProps {
  pigId: string;
  pigName: string;
  currentPrimary: PrimaryEmotion; // Today's zone to start with
  onNewReflection: () => void;
  onMomentSelected?: (selected: boolean) => void; // Notify parent when moment is expanded/closed
}

const EASING = [0.65, 0, 0.35, 1] as const;

// Tower configuration with corrected zone labels
// MAPPING: joyful→Vera, powerful→Ashmere, peaceful→Haven, sad→Vanta, scared→Vire, mad→Sable
// ZONE LABELS: Vera (Joyful), Ashmere (Powerful), Haven (Peaceful), Vanta (Sad), Vire (Fearful), Sable (Angry)
// Mobile-optimized: Shifted left (4→2%), narrower spacing (14→13%) to fit all 6 towers
const TOWER_CONFIGS = [
  { id: 'joyful' as PrimaryEmotion, name: 'Vera', label: 'Joyful', color: '#FFD700', x: 2, height: 180 },
  { id: 'powerful' as PrimaryEmotion, name: 'Ashmere', label: 'Powerful', color: '#FF6B35', x: 15, height: 220 },
  { id: 'peaceful' as PrimaryEmotion, name: 'Haven', label: 'Peaceful', color: '#6A9FB5', x: 28, height: 160 },
  { id: 'sad' as PrimaryEmotion, name: 'Vanta', label: 'Sad', color: '#7D8597', x: 41, height: 200 },
  { id: 'scared' as PrimaryEmotion, name: 'Vire', label: 'Fearful', color: '#5A189A', x: 54, height: 190 },
  { id: 'mad' as PrimaryEmotion, name: 'Sable', label: 'Angry', color: '#C1121F', x: 67, height: 170 },
];

export default function MomentsLibrary({
  pigId,
  pigName,
  currentPrimary,
  onNewReflection,
  onMomentSelected,
}: MomentsLibraryProps) {
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<'intro' | 'skyline' | 'library'>('intro');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  const [hoveredTower, setHoveredTower] = useState<PrimaryEmotion | null>(null);
  const [visibleTowers, setVisibleTowers] = useState<Set<PrimaryEmotion>>(new Set([currentPrimary]));
  const [isLoading, setIsLoading] = useState(true);
  const [blinkingWindow, setBlinkingWindow] = useState<string | null>(null);
  const [showIntroBubble, setShowIntroBubble] = useState(false);
  
  // Language toggle state
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [translatedContent, setTranslatedContent] = useState<TranslatedMoment | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Image rendering state
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageRendered, setImageRendered] = useState(false);
  
  // Songs are enriched automatically by worker - no separate loading state needed
  
  const containerRef = useRef<HTMLDivElement>(null);
  const leoRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Log component mount
  useEffect(() => {
    console.log('[MomentsLibrary] 🎬 Component mounted!', { pigId, pigName, currentPrimary });
  }, []);

  // Reset language state when modal closes
  useEffect(() => {
    if (!selectedMoment) {
      setLanguage('en');
      setTranslatedContent(null);
      setIsTranslating(false);
      setImageLoadError(false);
      setImageRendered(false);
    }
  }, [selectedMoment]);

  // Track image rendering telemetry (non-PII)
  useEffect(() => {
    if (selectedMoment?.image_base64 && !imageRendered && !imageLoadError) {
      // Log successful image render (once per modal open)
      console.log('[MomentsLibrary] 📸 Image rendered successfully', {
        momentId: selectedMoment.id,
        imageSize: selectedMoment.image_base64.length,
        timestamp: new Date().toISOString(),
      });
      setImageRendered(true);
    }
  }, [selectedMoment, imageRendered, imageLoadError]);

  // Songs are already enriched by enrichment worker - no need to fetch separately
  // They're loaded with the moment data from Redis

  // Translation function
  const handleLanguageToggle = async () => {
    if (!selectedMoment) return;

    if (language === 'en') {
      // Translate to Hindi
      setIsTranslating(true);
      
      try {
        const [textResult, invokedResult, expressedResult, ...poemResults] = await Promise.all([
          translateToHindi(selectedMoment.text),
          translateToHindi(selectedMoment.invoked),
          translateToHindi(selectedMoment.expressed),
          ...selectedMoment.poems.map(poem => translateToHindi(poem)),
        ]);

        const tipsResults = await Promise.all(
          selectedMoment.tips.map(tip => translateToHindi(tip))
        );

        const closingResult = await translateToHindi(selectedMoment.closingLine);

        setTranslatedContent({
          text: textResult.translatedText,
          invoked: invokedResult.translatedText,
          expressed: expressedResult.translatedText,
          poems: poemResults.map(r => r.translatedText),
          tips: tipsResults.map(r => r.translatedText),
          closingLine: closingResult.translatedText,
        });

        setLanguage('hi');
        
        // Announce language change for accessibility
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = 'Language set to Hindi';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    } else {
      // Switch back to English
      setLanguage('en');
      
      // Announce language change for accessibility
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = 'Language set to English';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  };

  // Keyboard support: ESC closes modal
  useEffect(() => {
    if (!selectedMoment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMoment(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMoment]);

  // Scroll to top when modal opens (fix for content pushed off-screen bug)
  useEffect(() => {
    if (selectedMoment && modalRef.current) {
      // Immediate scroll to top
      modalRef.current.scrollTop = 0;
      // Also scroll after a short delay to ensure DOM is rendered
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [selectedMoment]);

  // Focus trap and initial focus
  useEffect(() => {
    if (selectedMoment && modalRef.current) {
      // Focus the modal container
      modalRef.current.focus();
    }
    
    // Notify parent when moment selection changes
    onMomentSelected?.(!!selectedMoment);
  }, [selectedMoment, onMomentSelected]);

  // Fetch moments from API with retry logic
  useEffect(() => {
    const fetchMoments = async (retryCount = 0): Promise<void> => {
      const maxRetries = 3;
      const retryDelay = 2000; // 2s between retries
      
      try {
        console.log(`[MomentsLibrary] 📡 Fetching moments for pig: ${pigId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        const response = await fetch(`/api/pig/${pigId}/moments`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('[MomentsLibrary] ✅ Successfully fetched moments:', {
          count: data.count,
          success: data.success,
          hasMoments: !!data.moments,
          momentsLength: data.moments?.length || 0,
        });
        
        // Log zone distribution
        if (data.moments && data.moments.length > 0) {
          const zoneCount = data.moments.reduce((acc: Record<string, number>, m: Moment) => {
            acc[m.zone] = (acc[m.zone] || 0) + 1;
            return acc;
          }, {});
          console.log('[MomentsLibrary] 📊 Moments by zone:', zoneCount);
        } else {
          console.log('[MomentsLibrary] 🏜️ No moments found - city is empty');
        }
        
        setMoments(data.moments || []);
      } catch (error) {
        console.error(`[MomentsLibrary] ❌ Error fetching moments (attempt ${retryCount + 1}):`, error);
        
        // Retry logic
        if (retryCount < maxRetries) {
          console.log(`[MomentsLibrary] 🔄 Retrying in ${retryDelay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return fetchMoments(retryCount + 1);
        } else {
          console.error('[MomentsLibrary] ❌ Max retries reached. Showing empty state.');
          setMoments([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMoments();
  }, [pigId]);

  // Phase A → B: Tower re-introduction sequence
  useEffect(() => {
    if (phase !== 'intro') return;

    console.log('[MomentsLibrary] 🏛️ Starting intro phase with current tower:', currentPrimary);

    const sequence = async () => {
      // Wait 1.2s idle after intro
      console.log('[MomentsLibrary] ⏳ Waiting 1.2s before skyline rebuild...');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Trigger tower re-introduction
      console.log('[MomentsLibrary] 🌆 Transitioning to skyline phase');
      setPhase('skyline');
      
      // Sequentially reveal towers
      const towerOrder = TOWER_CONFIGS.filter(t => t.id !== currentPrimary).map(t => t.id);
      console.log('[MomentsLibrary] 🏗️ Revealing towers in order:', towerOrder);
      
      for (let i = 0; i < towerOrder.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 160)); // 160ms stagger
        console.log('[MomentsLibrary] ✨ Revealing tower:', towerOrder[i]);
        setVisibleTowers(prev => new Set([...prev, towerOrder[i]]));
      }
      
      // Wait for all towers to settle
      console.log('[MomentsLibrary] ⏳ All towers revealed, settling...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Transition to library phase
      console.log('[MomentsLibrary] 📚 Transitioning to library phase');
      setPhase('library');
    };

    sequence();
  }, [phase, currentPrimary]);

  // Show intro bubble when library phase loads
  useEffect(() => {
    if (phase === 'library' && moments.length > 0) {
      // Wait 1s for everything to settle, then show bubble
      const timer = setTimeout(() => {
        setShowIntroBubble(true);
        
        // Auto-hide after 4 seconds
        setTimeout(() => setShowIntroBubble(false), 4000);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [phase, moments.length]);

  // Idle window blink animation - hints at interactivity
  useEffect(() => {
    if (phase !== 'library' || moments.length === 0) return;

    const blinkRandomWindow = () => {
      // Pick a random moment
      const randomMoment = moments[Math.floor(Math.random() * moments.length)];
      setBlinkingWindow(`window-${randomMoment.zone}-${randomMoment.id}`);
      
      // Clear after 1.5s
      setTimeout(() => setBlinkingWindow(null), 1500);
    };

    // Blink every 5-8 seconds
    const interval = setInterval(() => {
      blinkRandomWindow();
    }, 5000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [phase, moments]);

  // Group moments by zone (always grouped by zones now)
  const momentsByZone = moments.reduce((acc, moment) => {
    if (!acc[moment.zone]) acc[moment.zone] = [];
    acc[moment.zone].push(moment);
    return acc;
  }, {} as Record<PrimaryEmotion, Moment[]>);

  // Get moment count for a tower
  const getMomentCount = (zone: PrimaryEmotion) => {
    return momentsByZone[zone]?.length || 0;
  };

  // Get tower config
  const getTowerConfig = (zone: PrimaryEmotion) => {
    return TOWER_CONFIGS.find(t => t.id === zone);
  };

  // Get the newest moment ID across all towers (for brightest glow)
  const newestMomentId = moments[0]?.id || null;

  return (
    <motion.div 
      ref={containerRef} 
      className="fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Sky background - deep mauve to soft peach dawn gradient (symbolizes reflection & renewal) */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #4A3B5E 0%, #6B5380 20%, #8B6A9E 40%, #CFA8E0 60%, #E8C5D9 80%, #FFDAB9 100%)',
        }}
        animate={{
          filter: [
            'brightness(1) blur(0px)',
            'brightness(1.03) blur(1px)',
            'brightness(1) blur(0px)',
          ],
        }}
        transition={{ 
          duration: 5, 
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
      
      {/* Loading shimmer during fetch */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              className="text-2xl mb-4 italic"
              style={{
                fontFamily: '"EB Garamond", "Georgia", serif',
                color: '#5A4962',
                textShadow: '0 2px 10px rgba(90, 73, 98, 0.3)',
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              Awakening your city...
            </motion.div>
            <motion.div
              className="w-48 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full mx-auto"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        </div>
      )}
      
      {/* Atmospheric haze at skyline base */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '30vh',
          background: 'linear-gradient(to top, rgba(250, 210, 214, 0.4) 0%, rgba(207, 168, 224, 0.2) 50%, transparent 100%)',
          filter: 'blur(20px)',
        }}
        animate={{
          opacity: [0.6, 0.8, 0.6],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Stars with parallax drift and random twinkling */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 150 }).map((_, i) => {
          const size = Math.random() > 0.7 ? 2 : 1;
          const twinkleDuration = 2 + Math.random() * 3;
          const twinleDelay = Math.random() * 4;
          const driftDistance = Math.random() * 30 - 15; // -15 to +15 px horizontal drift
          const driftDuration = 40 + Math.random() * 20; // 40-60s slow drift
          
          return (
            <motion.div
              key={`star-${i}`}
              className="absolute bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`, // Keep in upper 60% of screen
                width: `${size}px`,
                height: `${size}px`,
              }}
              animate={{
                opacity: [0.6, 0.8, 0.6],
                scale: [1, 1.2, 1],
                x: [0, driftDistance, 0], // Slow horizontal parallax drift
              }}
              transition={{
                opacity: {
                  duration: twinkleDuration,
                  repeat: Infinity,
                  delay: twinleDelay,
                  ease: 'easeInOut',
                },
                scale: {
                  duration: twinkleDuration,
                  repeat: Infinity,
                  delay: twinleDelay,
                  ease: 'easeInOut',
                },
                x: {
                  duration: driftDuration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            />
          );
        })}
      </div>

      {/* Leo - ~18% larger with breathing glow, positioned between header and building labels */}
      <motion.div
        ref={leoRef}
        className="absolute z-40"
        initial={{ left: '50%', top: '40%', x: '-50%', y: '-50%', scale: 1 }}
        animate={
          phase === 'library'
            ? { left: '50%', top: '24%', x: '-50%', y: '0%', scale: 0.85 }
            : { left: '50%', top: '40%', x: '-50%', y: '-50%', scale: 1 }
        }
        transition={{ duration: 1.2, ease: EASING }}
      >
        {/* Breathing glow pulse (slow, rhythmic) */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 210, 220, 0.4) 0%, transparent 70%)',
            filter: 'blur(30px)',
            transform: 'scale(1.3)',
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1.25, 1.4, 1.25],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <motion.div
          animate={{
            y: [0, -5, 0, -3, 0],
            rotate: [0, 1, 0, -1, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.25, 0.5, 0.75, 1],
          }}
        >
          <motion.div
            animate={{
              filter: [
                'drop-shadow(0 0 20px rgba(255, 210, 220, 0.3))',
                'drop-shadow(0 0 30px rgba(255, 210, 220, 0.5))',
                'drop-shadow(0 0 20px rgba(255, 210, 220, 0.3))',
              ],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Image src="/images/leo.svg" alt="Leo" width={188} height={188} priority />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Intro bubble - "You can glance at today's moment through this window" */}
      <AnimatePresence>
        {showIntroBubble && (
          <motion.div
            className="absolute top-[15%] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.6, ease: EASING }}
          >
            <div
              className="px-6 py-4 rounded-2xl shadow-2xl max-w-sm text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 245, 0.98) 100%)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(156, 31, 95, 0.15)',
                boxShadow: '0 12px 40px rgba(156, 31, 95, 0.15), 0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <p
                className="text-base font-medium"
                style={{
                  fontFamily: '"EB Garamond", "Georgia", serif',
                  color: '#2D2D2D',
                  lineHeight: '1.5',
                  letterSpacing: '0.3px',
                }}
              >
                You can glance at today's moment through this window
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skyline - six towers */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-25"
        style={{ height: '50vh' }}
        initial={{ scale: 1, y: 0 }}
        animate={{ scale: phase === 'skyline' ? 0.92 : 1, y: 0 }}
        transition={{ duration: 1.5, ease: EASING }}
      >
        {TOWER_CONFIGS.map((tower, index) => {
          const zone = getZone(tower.id);
          const isVisible = visibleTowers.has(tower.id);
          const isCurrent = tower.id === currentPrimary;
          const isHovered = hoveredTower === tower.id;
          const momentCount = getMomentCount(tower.id);
          const hasMoments = momentCount > 0;

          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${tower.x}%`,
                width: '80px',
                height: `${tower.height * 1.8}px`,
              }}
              initial={{ opacity: isCurrent ? 1 : 0, scale: 0.9 }}
              animate={{
                opacity: isVisible ? (hasMoments ? 1 : 0.2) : 0,
                scale: isVisible ? (isHovered ? 1.05 : 1) : 0.9,
              }}
              transition={{
                opacity: { duration: 1, ease: 'easeOutQuart' },
                scale: { duration: 0.3 },
                delay: isCurrent ? 0 : index * 0.16,
              }}
              onMouseEnter={() => setHoveredTower(tower.id)}
              onMouseLeave={() => setHoveredTower(null)}
              role="button"
              aria-label={`${zone?.name || tower.id} tower, ${momentCount} moments`}
            >
              {/* Tower body - SAME STYLE AS INTERLUDE */}
              <div
                className="w-full h-full relative"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  border: `1px solid ${tower.color}40`,
                  borderRadius: '2px 2px 0 0',
                }}
              >
                {/* Windows - warm lit windows representing moments */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {momentsByZone[tower.id]?.slice(0, 24).map((moment, i) => {
                    const windowKey = `window-${tower.id}-${moment.id}`;
                    const isBlinking = blinkingWindow === windowKey;
                    const isNewest = moment.id === newestMomentId; // Only THE newest moment across all towers glows brightest
                    
                    return (
                      <motion.div
                        key={windowKey}
                        className="rounded-[1px] cursor-pointer relative group"
                        style={{ cursor: 'pointer' }}
                        animate={{
                          backgroundColor: isNewest
                            ? [
                                `rgba(255, 245, 220, 1)`,
                                `rgba(255, 255, 240, 1)`,
                                `rgba(255, 245, 220, 1)`,
                              ]
                            : isBlinking 
                            ? [
                                `rgba(255, 230, 200, 0.9)`,
                                `rgba(255, 245, 220, 1)`,
                                `rgba(255, 230, 200, 0.9)`,
                              ]
                            : [
                                `rgba(248, 216, 181, 0.15)`,
                                `rgba(255, 230, 200, 0.5)`,
                                `rgba(248, 216, 181, 0.15)`,
                              ],
                          boxShadow: isNewest
                            ? [
                                `0 0 20px rgba(255, 230, 200, 0.9), 0 4px 40px rgba(255, 215, 0, 0.7)`,
                                `0 0 30px rgba(255, 245, 220, 1), 0 6px 50px rgba(255, 215, 0, 0.9)`,
                                `0 0 20px rgba(255, 230, 200, 0.9), 0 4px 40px rgba(255, 215, 0, 0.7)`,
                              ]
                            : isBlinking
                            ? [
                                `0 0 8px rgba(255, 230, 200, 0.4)`,
                                `0 0 25px rgba(255, 230, 200, 0.9), 0 4px 30px rgba(255, 230, 200, 0.6)`,
                                `0 0 8px rgba(255, 230, 200, 0.4)`,
                              ]
                            : `0 0 0px transparent`,
                        }}
                        transition={{
                          duration: isNewest ? 1.5 : (isBlinking ? 0.8 : 2 + Math.random() * 2),
                          repeat: Infinity,
                          delay: isBlinking ? 0 : i * 0.1,
                        }}
                        whileHover={{
                          scale: 1.3,
                          backgroundColor: `rgba(255, 230, 200, 0.95)`,
                          boxShadow: `0 0 20px rgba(255, 230, 200, 0.8), 0 6px 40px rgba(255, 230, 200, 0.5)`,
                        }}
                        onClick={() => setSelectedMoment(moment)}
                      >
                        {/* Vertical glow pulse on hover */}
                        <motion.div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
                          style={{
                            background: `linear-gradient(to bottom, transparent 0%, rgba(255, 230, 200, 0.6) 50%, transparent 100%)`,
                            filter: 'blur(4px)',
                          }}
                          animate={{
                            y: ['-100%', '100%'],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                        
                        {/* Window tooltip on hover */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-xs text-gray-800 max-w-xs">
                            <div className="font-semibold mb-1 text-purple-600">Open this moment</div>
                            <div className="font-medium mb-1">
                              {moment.text.slice(0, 60)}{moment.text.length > 60 ? '...' : ''}
                            </div>
                            <div className="text-gray-500">
                              {new Date(moment.timestamp).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Building name with zone label - translucent, naturally placed above building */}
                <AnimatePresence>
                  {phase === 'library' && isVisible && hasMoments && (
                    <motion.div
                      className="absolute left-0 right-0 whitespace-nowrap z-30 text-center"
                      style={{
                        top: '-6rem', // Moved up slightly from -top-28 (-7rem) for better spacing
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: isHovered ? 1 : 0.9,
                        y: 0,
                      }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      {/* Tower name - smaller font for mobile fit, centered */}
                      <motion.div
                        className="font-serif italic text-2xl md:text-3xl font-bold pointer-events-none mb-1 text-center w-full"
                        style={{
                          color: tower.color,
                          textShadow: isHovered
                            ? `
                                0 0 50px ${tower.color},
                                0 0 100px ${tower.color},
                                0 0 150px ${tower.color},
                                0 2px 12px rgba(0,0,0,0.5),
                                0 0 4px rgba(255,255,255,0.8)
                              `
                            : `
                                0 0 40px ${tower.color},
                                0 0 80px ${tower.color},
                                0 0 120px ${tower.color},
                                0 2px 12px rgba(0,0,0,0.5),
                                0 0 4px rgba(255,255,255,0.8)
                              `,
                        }}
                      >
                        {tower.name}
                      </motion.div>
                      
                      {/* Zone label - enhanced visibility with background and stronger contrast, centered */}
                      <motion.div
                        className="text-xs md:text-sm font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full inline-block"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          fontFamily: '"Inter", -apple-system, sans-serif',
                          color: '#FFFFFF',
                          backgroundColor: `${tower.color}DD`,
                          textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 12px ${tower.color}`,
                          boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 0 20px ${tower.color}60`,
                        }}
                      >
                        {tower.label}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tower base reflection - soft radial haze for depth */}
              {phase === 'library' && isVisible && hasMoments && (
                <motion.div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    width: '120px',
                    height: '40px',
                    background: `radial-gradient(ellipse, ${tower.color}30 0%, transparent 70%)`,
                    filter: 'blur(15px)',
                  }}
                  animate={{
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Current tower glow pulse */}
              {isCurrent && phase === 'intro' && (
                <motion.div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${zone?.color}99 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                  }}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    times: [0, 0.5, 1],
                    ease: 'easeInOut',
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Title - more spacing from top to clear sign-in button, sequential fade-in */}
      <AnimatePresence>
        {phase === 'library' && (
          <>
            {/* Main Title - increased top spacing to avoid overlap with sign-in */}
            <motion.div
              className="absolute left-0 right-0 z-20 text-center pointer-events-none px-4"
              style={{
                top: '6rem', // Increased from top-20 (5rem) to 6rem for clearance from sign-in button
              }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASING }}
            >
              <h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-3"
                style={{
                  fontFamily: '"EB Garamond", "Georgia", serif',
                  fontWeight: 500,
                  color: '#3A263F',
                  textShadow: '0 2px 20px rgba(58, 38, 63, 0.2)',
                  letterSpacing: '0.02em',
                }}
              >
                Living City of Moments
              </h1>
            </motion.div>
            
            {/* Subtitle - layered reveal after title, enhanced visibility with more spacing */}
            <motion.div
              className="absolute left-0 right-0 z-20 text-center pointer-events-none px-4"
              style={{
                top: '11rem', // Increased from top-40 (10rem) to 11rem for better spacing
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: EASING }}
            >
              <p
                className="text-sm sm:text-base md:text-lg"
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  color: '#2B1D33',
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  textShadow: '0 1px 3px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(43, 29, 51, 0.25)',
                }}
              >
                Each window holds a breath you once shared.
              </p>
            </motion.div>

            {/* Share a New Moment Icon - top-left, same size as sound toggle for visual consistency */}
            <motion.button
              className="fixed left-2 md:left-4 z-50 pointer-events-auto rounded-full overflow-hidden group"
              onClick={onNewReflection}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ 
                scale: 1.1,
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.6, delay: 1.4, ease: EASING }}
              aria-label="Share a New Moment"
              title="Share a New Moment"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFC1CC 100%)',
                boxShadow: '0 4px 16px rgba(255, 215, 0, 0.3)',
                width: '32px',  // Match SoundToggle size
                height: '32px', // Match SoundToggle size
                minWidth: '32px',
                minHeight: '32px',
                padding: '6px', // Match SoundToggle padding
                top: 'max(1rem, env(safe-area-inset-top))', // Aligned with top navigation
                paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
              }}
            >
              {/* Sparkle with occasional pulse */}
              <motion.div
                className="w-full h-full flex items-center justify-center"
                animate={{
                  filter: [
                    'drop-shadow(0 0 4px rgba(255, 215, 0, 0.4))',
                    'drop-shadow(0 0 12px rgba(255, 215, 0, 0.8))',
                    'drop-shadow(0 0 4px rgba(255, 215, 0, 0.4))',
                  ],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <motion.span 
                  className="text-lg" // Reduced from text-2xl to fit smaller button
                  animate={{
                    scale: [1, 1.15, 1],
                    rotate: [0, 12, -12, 0],
                  }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  ✨
                </motion.span>
              </motion.div>
              
              {/* Tooltip on hover */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-xs text-gray-800">
                  <div className="font-semibold">Share a New Moment</div>
                </div>
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && phase === 'library' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div 
            className="text-white text-lg italic"
            style={{
              fontFamily: '"EB Garamond", "Georgia", serif',
            }}
          >
            Loading your moments...
          </div>
        </div>
      )}

      {/* Empty State - brief centered message with fade */}
      {!isLoading && phase === 'library' && moments.length === 0 && (
        <motion.div 
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <motion.div 
            className="text-center px-6"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 6, times: [0, 0.7, 1], ease: 'easeInOut' }}
          >
            <div 
              className="text-2xl md:text-3xl mb-4 italic"
              style={{
                fontFamily: '"EB Garamond", "Georgia", serif',
                color: '#5A4962',
                textShadow: '0 2px 10px rgba(90, 73, 98, 0.3)',
              }}
            >
              Your city is waiting to light up.
            </div>
            <div 
              className="text-base md:text-lg mb-2"
              style={{
                fontFamily: '"Inter", -apple-system, sans-serif',
                color: '#8A7999',
              }}
            >
              Click the sparkle above to create your first moment.
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Moment Detail Modal - Redesigned as Emotional Atmosphere */}
      <AnimatePresence>
        {selectedMoment && (() => {
          // Emotion-based glass gradient palettes - cinematic window vignette
          const atmosphereConfig = {
            sad: {
              gradient: ['#C6D4EC', '#AEBEDD', '#BFD5F9'], // pale blues with depth
              header: "The sky hung heavy with quiet remembering.",
              ambientMotion: 'drizzle',
              textColor: '#102336', // Deep blue-black
              textMuted: '#2A3F52',
              accentColor: '#BFD5F9',
              accentGlow: 'rgba(191, 213, 249, 0.4)',
            },
            joyful: {
              gradient: ['#FFF5CA', '#FFD88E', '#FFD477'], // warm amber layers
              header: "The day gleamed with open laughter.",
              ambientMotion: 'motes',
              textColor: '#5C3A00', // Rich brown
              textMuted: '#805200',
              accentColor: '#FFD477',
              accentGlow: 'rgba(255, 212, 119, 0.4)',
            },
            powerful: {
              gradient: ['#CBE8CA', '#A8D9A7', '#C6F5B8'], // mint-green vitality
              header: "The ground beneath you hummed steady and sure.",
              ambientMotion: 'pulse',
              textColor: '#173217', // Forest green
              textMuted: '#2B4A2B',
              accentColor: '#C6F5B8',
              accentGlow: 'rgba(198, 245, 184, 0.35)',
            },
            mad: {
              gradient: ['#FFD2C7', '#FFB2A0', '#FF7648'], // ember orange warmth
              header: "The air crackled with restless thunder.",
              ambientMotion: 'sparks',
              textColor: '#3A0B05', // Deep burnt sienna
              textMuted: '#5A2015',
              accentColor: '#FF7648',
              accentGlow: 'rgba(255, 118, 72, 0.4)',
            },
            peaceful: {
              gradient: ['#E4E8F6', '#C8CFE6', '#D4D8FA'], // pale lavender tranquility
              header: "Stillness gathered like a soft mist over your heart.",
              ambientMotion: 'mist',
              textColor: '#2D2A54', // Deep indigo
              textMuted: '#4A4570',
              accentColor: '#D4D8FA',
              accentGlow: 'rgba(212, 216, 250, 0.5)',
            },
            scared: {
              gradient: ['#D8C6E5', '#BBA3D4', '#D7B8FF'], // violet twilight
              header: "A hush crept along the edges of your light.",
              ambientMotion: 'orbs',
              textColor: '#2A0F38', // Deep violet-black
              textMuted: '#442558',
              accentColor: '#D7B8FF',
              accentGlow: 'rgba(215, 184, 255, 0.4)',
            },
          };

          const atmosphere = atmosphereConfig[selectedMoment.zone as keyof typeof atmosphereConfig] || atmosphereConfig.peaceful;

          return (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMoment(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="moment-header"
            >
              {/* Backdrop with emotion-tinted blur */}
              <motion.div 
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at center, ${atmosphere.gradient[0]}40 0%, rgba(0,0,0,0.6) 100%)`,
                  backdropFilter: 'blur(16px)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                aria-hidden="true"
              />
              
              {/* Modal Card - Cinematic Glass Window Vignette */}
              <motion.div
                ref={modalRef}
                className="relative max-w-2xl w-full max-h-[90vh] md:max-h-[85vh] overflow-y-auto custom-scrollbar"
                initial={{ scale: 0.85, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ 
                  scale: 0.9, 
                  y: -20, 
                  opacity: 0,
                  transition: { duration: 0.4 }
                }}
                transition={{ duration: 0.6, ease: EASING }}
                onClick={(e) => e.stopPropagation()}
                onAnimationComplete={() => {
                  // Scroll to top when modal opens (fix for content pushed off-screen)
                  if (modalRef.current) {
                    modalRef.current.scrollTop = 0;
                  }
                }}
                tabIndex={-1}
                style={{
                  backdropFilter: 'blur(12px) saturate(120%) brightness(1.05)',
                  borderRadius: '32px',
                  border: `1px solid rgba(255, 255, 255, 0.25)`,
                  boxShadow: `
                    0 0 0 1px ${atmosphere.gradient[0]}40,
                    0 24px 72px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255,255,255,0.5)
                  `,
                  scrollBehavior: 'smooth',
                }}
              >
                {/* Inner wrapper - contains backgrounds and content, expands to full content height */}
                <div className="relative min-h-full">
                  {/* Background gradient layer - scrolls with content */}
                  <div 
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
                    style={{
                      background: `linear-gradient(180deg, 
                        ${atmosphere.gradient[0]} 0%, 
                        ${atmosphere.gradient[1]} 50%,
                        ${atmosphere.gradient[0]} 100%)`,
                    }}
                  />

                  {/* Foreground contrast overlay - ensures text legibility with soft-light blend */}
                  <div 
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
                    style={{
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.12))',
                      mixBlendMode: 'soft-light',
                    }}
                  />

                  {/* Subtle vignette mask - focuses attention inward */}
                  <div 
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
                    style={{
                      background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.15), rgba(0,0,0,0.3) 90%)',
                    }}
                  />

                  {/* Radial lighting layer - origin from top-left (city glow effect) */}
                  <div 
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
                    style={{
                      background: `radial-gradient(circle at 15% 20%, ${atmosphere.accentGlow} 0%, transparent 60%)`,
                      opacity: 0.6,
                    }}
                  />

                  {/* Ambient motion particles based on emotion - constrained to background layer, max 40 particles */}
                  <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden rounded-[32px] pointer-events-none z-0">
                  {/* Sad: Fine vertical rain streaks */}
                  {atmosphere.ambientMotion === 'drizzle' && Array.from({ length: 15 }).map((_, i) => (
                    <motion.div
                      key={`drizzle-${i}`}
                      className="absolute w-[1px] bg-gradient-to-b from-transparent via-blue-300/30 to-transparent"
                      style={{
                        left: `${Math.random() * 100}%`,
                        height: `${20 + Math.random() * 40}px`,
                        willChange: 'transform',
                      }}
                      initial={{ top: '-20%', opacity: 0 }}
                      animate={{ 
                        top: '120%', 
                        opacity: [0, 0.6, 0],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 3,
                        ease: 'linear',
                      }}
                    />
                  ))}
                  
                  {/* Joyful: Floating golden dust */}
                  {atmosphere.ambientMotion === 'motes' && Array.from({ length: 25 }).map((_, i) => (
                    <motion.div
                      key={`mote-${i}`}
                      className="absolute w-1 h-1 rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.gradient[1]} 0%, transparent 70%)`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        willChange: 'transform, opacity',
                      }}
                      animate={{
                        y: [0, -30, 0],
                        x: [0, Math.random() * 20 - 10, 0],
                        opacity: [0, 0.8, 0],
                        scale: [0, 1, 0],
                      }}
                      transition={{
                        duration: 4 + Math.random() * 3,
                        repeat: Infinity,
                        delay: Math.random() * 4,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                  
                  {/* Peaceful: Slow drifting mist */}
                  {atmosphere.ambientMotion === 'mist' && Array.from({ length: 4 }).map((_, i) => (
                    <motion.div
                      key={`mist-${i}`}
                      className="absolute rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.gradient[0]}20 0%, transparent 70%)`,
                        width: `${100 + Math.random() * 200}px`,
                        height: `${100 + Math.random() * 200}px`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        filter: 'blur(40px)',
                        willChange: 'transform, opacity',
                      }}
                      animate={{
                        x: [0, 50, 0],
                        y: [0, -30, 0],
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 8 + i * 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}

                  {/* Powerful: Heartbeat pulse wave */}
                  {atmosphere.ambientMotion === 'pulse' && Array.from({ length: 3 }).map((_, i) => (
                    <motion.div
                      key={`pulse-${i}`}
                      className="absolute rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.accentGlow} 0%, transparent 70%)`,
                        width: '200px',
                        height: '200px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        filter: 'blur(30px)',
                        willChange: 'transform, opacity',
                      }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.8,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}

                  {/* Mad: Ember sparks */}
                  {atmosphere.ambientMotion === 'sparks' && Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={`spark-${i}`}
                      className="absolute w-1 h-1 rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.gradient[2]} 0%, ${atmosphere.gradient[1]} 50%, transparent 100%)`,
                        left: `${Math.random() * 100}%`,
                        bottom: '0%',
                        boxShadow: `0 0 8px ${atmosphere.accentGlow}`,
                        willChange: 'transform, opacity',
                      }}
                      animate={{
                        y: [0, -100 - Math.random() * 150],
                        x: [0, (Math.random() - 0.5) * 80],
                        opacity: [0.8, 0.4, 0],
                        scale: [1.2, 0.8, 0.3],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 3,
                        ease: 'easeOut',
                      }}
                    />
                  ))}

                  {/* Scared: Faint light orbs fading in/out */}
                  {atmosphere.ambientMotion === 'orbs' && Array.from({ length: 8 }).map((_, i) => (
                    <motion.div
                      key={`orb-${i}`}
                      className="absolute rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.gradient[2]}60 0%, transparent 70%)`,
                        width: `${30 + Math.random() * 50}px`,
                        height: `${30 + Math.random() * 50}px`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        filter: 'blur(20px)',
                        willChange: 'opacity',
                      }}
                      animate={{
                        opacity: [0, 0.6, 0],
                        scale: [0.8, 1.1, 0.8],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 4,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>

                {/* Content guard - isolates text from background effects */}
                <div className="relative p-6 md:p-10 z-10" style={{ lineHeight: '1.8', isolation: 'isolate' }}>
                  {/* Atmospheric Header */}
                  <motion.div
                    className="mb-12"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: EASING }}
                    role="region"
                    aria-label="Moment atmosphere"
                  >
                    <motion.h2
                      id="moment-header"
                      className="text-[20px] md:text-[22px] italic mb-4"
                      style={{
                        fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                        color: atmosphere.textColor,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        lineHeight: '1.8',
                        textShadow: `0 1px 2px rgba(0,0,0,0.15)`,
                        opacity: 0.95,
                      }}
                      animate={{
                        opacity: [0.93, 0.98, 0.93],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      {atmosphere.header}
                    </motion.h2>
                    
                    {/* Timestamp with action buttons */}
                    <div className="flex items-center justify-between gap-4">
                      <div 
                        className="text-xs uppercase tracking-widest"
                        style={{
                          fontFamily: '"Inter", -apple-system, sans-serif',
                          color: atmosphere.textMuted,
                          letterSpacing: '0.15em',
                          opacity: 0.7,
                          textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                        }}
                      >
                        {new Date(selectedMoment.timestamp).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      
                      {/* Action buttons - EN/HI, WhatsApp, Close */}
                      <div 
                        className="flex items-center gap-1.5"
                        style={{
                          backdropFilter: 'blur(12px)',
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
                          borderRadius: '50px',
                          padding: '4px',
                          boxShadow: `0 4px 20px ${atmosphere.gradient[0]}30`,
                        }}
                      >
                        {/* Language Toggle */}
                        <motion.button
                          onClick={handleLanguageToggle}
                          disabled={isTranslating}
                          className="w-8 h-8 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                          style={{
                            background: language === 'en' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
                            opacity: isTranslating ? 0.5 : 1,
                          }}
                          whileHover={{ 
                            scale: isTranslating ? 1 : 1.1,
                            background: 'rgba(255,255,255,1)',
                          }}
                          whileTap={{ scale: isTranslating ? 1 : 0.95 }}
                          aria-label={language === 'en' ? 'Translate to Hindi' : 'Show in English'}
                          title={language === 'en' ? 'हिंदी' : 'English'}
                        >
                          <span className="text-xs font-semibold" style={{ color: atmosphere.textColor }}>
                            {isTranslating ? '...' : (language === 'en' ? 'हि' : 'En')}
                          </span>
                        </motion.button>

                        {/* WhatsApp Share */}
                        <motion.button
                          onClick={async () => {
                            // Build beautifully formatted greeting card message
                            let shareText = '';
                            
                            // Header with decorative frame
                            shareText += `╭─────────────────────╮\n`;
                            shareText += `│  A Moment Held Safe  │\n`;
                            shareText += `╰─────────────────────╯\n\n`;
                            
                            // Main reflection with quotation styling
                            shareText += `💭 *"${selectedMoment.text}"*\n\n`;
                            
                            // Emotional landscape
                            shareText += `✦ ─────────────── ✦\n\n`;
                            shareText += `_feeling:_\n`;
                            shareText += `  ${selectedMoment.invoked}\n`;
                            shareText += `    ↓\n`;
                            shareText += `  ${selectedMoment.expressed}\n\n`;
                            
                            // Poem (if available) with decorative spacing
                            if (selectedMoment.poems?.[0]) {
                              shareText += `✦ ─────────────── ✦\n\n`;
                              shareText += `_${selectedMoment.poems[0]}_\n\n`;
                            }
                            
                            // Song recommendation with elegant formatting
                            const song = selectedMoment.songs?.en || selectedMoment.songs?.hi;
                            if (song?.title) {
                              shareText += `✦ ─────────────── ✦\n\n`;
                              shareText += `🎵 _a song for this moment:_\n\n`;
                              shareText += `   *"${song.title}"*\n`;
                              if (song.artist) shareText += `   by ${song.artist}\n`;
                              if (song.year) shareText += `   (${song.year})\n`;
                              if (song.youtube_url) shareText += `\n   🔗 ${song.youtube_url}\n`;
                              shareText += '\n';
                            }
                            
                            // Footer with date and signature
                            shareText += `✦ ─────────────── ✦\n\n`;
                            const momentDate = new Date(selectedMoment.timestamp).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            });
                            shareText += `${momentDate}\n\n`;
                            
                            // Pig name signature
                            const pigName = selectedMoment.pig_name || 'Noen';
                            shareText += `     ✨ 🐷 ✨\n`;
                            shareText += `held safe by *${pigName}*\n\n`;
                            shareText += `━━━━━━━━━━━━━━━━━━━`;
                            
                            // Add note about image if present
                            if (selectedMoment.image_base64) {
                              shareText += `\n\n📸 _Photo captured with this moment_`;
                            }
                            
                            // Add shareable link to view full moment
                            const shareableUrl = `${window.location.origin}/share/${selectedMoment.id}`;
                            shareText += `\n\n🔗 View full moment: ${shareableUrl}`;
                            
                            // STRATEGY: If image exists, share via Web Share API with image + text as caption
                            // This works best on mobile WhatsApp
                            if (selectedMoment.image_base64 && navigator.share) {
                              try {
                                // Convert base64 to blob
                                const imageDataUrl = `data:image/jpeg;base64,${selectedMoment.image_base64}`;
                                const base64Response = await fetch(imageDataUrl);
                                const blob = await base64Response.blob();
                                const file = new File([blob], `moment-${pigName}.jpg`, { type: 'image/jpeg' });
                                
                                // Share image with formatted text as caption
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  await navigator.share({
                                    text: shareText,
                                    files: [file]
                                  });
                                  return; // Success - WhatsApp will show text as caption
                                }
                              } catch (shareErr: any) {
                                if (shareErr.name === 'AbortError') {
                                  return; // User cancelled
                                }
                                console.warn('[WhatsApp Share] Image share failed, falling back to text', shareErr);
                              }
                            }
                            
                            // Fallback 1: Try text-only share via Web Share API
                            if (navigator.share) {
                              try {
                                await navigator.share({
                                  text: shareText
                                });
                                return; // Success
                              } catch (shareErr: any) {
                                if (shareErr.name === 'AbortError') {
                                  return; // User cancelled
                                }
                                console.warn('[WhatsApp Share] Text share failed, using WhatsApp URL', shareErr);
                              }
                            }
                            
                            // Fallback 2: Direct WhatsApp URL with formatted text
                            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                          style={{ background: 'rgba(37, 211, 102, 0.15)' }}
                          whileHover={{ scale: 1.1, background: 'rgba(37, 211, 102, 0.25)' }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Share on WhatsApp"
                          title={selectedMoment.image_base64 ? 'Share with image' : 'Share text'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67ZM8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7 8.5 7 9.71C7 10.93 7.89 12.1 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 14C16.31 13.86 15.09 13.26 14.87 13.18C14.64 13.1 14.5 13.06 14.31 13.3C14.15 13.55 13.67 14.11 13.53 14.27C13.38 14.44 13.24 14.46 13 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.45 9.77 11.64 9.62 11.39C9.5 11.15 9.61 11 9.73 10.89C9.84 10.78 10 10.6 10.1 10.45C10.23 10.31 10.27 10.2 10.35 10.04C10.43 9.87 10.39 9.73 10.33 9.61C10.27 9.5 9.77 8.26 9.56 7.77C9.36 7.29 9.16 7.35 9 7.34C8.86 7.34 8.7 7.33 8.53 7.33Z" fill="#25D366"/>
                          </svg>
                        </motion.button>

                        {/* Copy Share Link */}
                        <motion.button
                          onClick={() => {
                            const shareableUrl = `${window.location.origin}/share/${selectedMoment.id}`;
                            navigator.clipboard.writeText(shareableUrl).then(() => {
                              // Optional: You could add a toast notification here
                              console.log('[Share] Link copied to clipboard');
                            }).catch(err => {
                              console.error('[Share] Failed to copy link:', err);
                            });
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                          style={{ background: 'rgba(147, 112, 219, 0.15)' }}
                          whileHover={{ scale: 1.1, background: 'rgba(147, 112, 219, 0.25)' }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Copy share link"
                          title="Copy link"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: atmosphere.textColor, opacity: 0.8 }}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </motion.button>

                        {/* Close */}
                        <motion.button
                          onClick={() => setSelectedMoment(null)}
                          className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                          style={{ background: 'rgba(255,255,255,0.5)' }}
                          whileHover={{ scale: 1.1, background: 'rgba(255,255,255,1)' }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Close"
                        >
                          <span className="text-xl leading-none" style={{ color: atmosphere.textColor }}>×</span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Base64 Image - below header, above "You wrote:" */}
                  {selectedMoment.image_base64 && !imageLoadError && (
                    <motion.div
                      className="mb-12 relative overflow-hidden"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.2, ease: EASING }}
                      style={{
                        borderRadius: '12px',
                        boxShadow: `0 8px 24px ${atmosphere.gradient[0]}20`,
                        maxHeight: '500px', // Guardrail: max display height
                      }}
                    >
                      {/* Soft gradient overlay for text contrast (optional, subtle) */}
                      <div 
                        className="absolute inset-0 pointer-events-none z-10"
                        style={{
                          background: `linear-gradient(to bottom, ${atmosphere.gradient[0]}08 0%, transparent 20%, transparent 80%, ${atmosphere.gradient[1]}08 100%)`,
                        }}
                      />
                      
                      {/* Image with progressive reveal */}
                      <motion.img
                        src={`data:image/jpeg;base64,${selectedMoment.image_base64}`}
                        alt="Moment image"
                        className="w-full h-auto object-contain"
                        style={{
                          borderRadius: '12px',
                          opacity: 0.95,
                        }}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 0.95, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        whileHover={{ 
                          opacity: 1,
                          transition: { duration: 0.3 }
                        }}
                        onError={() => {
                          console.warn('[MomentsLibrary] ⚠️ Image failed to load', {
                            momentId: selectedMoment.id,
                            timestamp: new Date().toISOString(),
                          });
                          setImageLoadError(true);
                        }}
                        loading="lazy"
                      />
                    </motion.div>
                  )}

                  {/* User's Original Reflection */}
                  <motion.div
                    className="mb-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                  >
                    <div 
                      className="text-xs italic mb-6"
                      style={{
                        fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                        color: atmosphere.textMuted,
                        letterSpacing: '0.02em',
                        opacity: 0.7,
                        textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                      }}
                    >
                      You wrote:
                    </div>
                    <p
                      className="text-[16px] md:text-[18px]"
                      style={{
                        fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                        color: atmosphere.textColor,
                        fontWeight: 400,
                        letterSpacing: '0.02em',
                        lineHeight: '1.8',
                        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      }}
                    >
                      {language === 'hi' && translatedContent ? translatedContent.text : selectedMoment.text}
                    </p>
                  </motion.div>

                  {/* Emotional Anatomy */}
                  <motion.div
                    className="mb-12 space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    {selectedMoment.invoked && (
                      <motion.div
                        className="pl-6 border-l-2"
                        style={{ borderColor: `${atmosphere.accentColor}40` }}
                        whileHover={{
                          borderColor: `${atmosphere.accentColor}80`,
                          x: 4,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <div 
                          className="text-[0.7rem] uppercase tracking-widest mb-3"
                          style={{
                            fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                            fontStyle: 'italic',
                            color: atmosphere.textMuted,
                            letterSpacing: '0.12em',
                            opacity: 0.7,
                            textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                          }}
                        >
                          What stirred the air
                        </div>
                        <div
                          className="text-[15px]"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            lineHeight: '1.8',
                            fontWeight: 400,
                            letterSpacing: '0.02em',
                            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          }}
                        >
                          {language === 'hi' && translatedContent ? translatedContent.invoked : selectedMoment.invoked}
                        </div>
                      </motion.div>
                    )}
                    
                    {selectedMoment.expressed && (
                      <motion.div
                        className="pl-6 border-l-2"
                        style={{ borderColor: `${atmosphere.accentColor}40` }}
                        whileHover={{
                          borderColor: `${atmosphere.accentColor}80`,
                          x: 4,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <div 
                          className="text-[0.7rem] uppercase tracking-widest mb-3"
                          style={{
                            fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                            fontStyle: 'italic',
                            color: atmosphere.textMuted,
                            letterSpacing: '0.12em',
                            opacity: 0.7,
                            textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                          }}
                        >
                          How it lingered in you
                        </div>
                        <div
                          className="text-[15px]"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            lineHeight: '1.8',
                            fontWeight: 400,
                            letterSpacing: '0.02em',
                            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          }}
                        >
                          {language === 'hi' && translatedContent ? translatedContent.expressed : selectedMoment.expressed}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* What the Wind Remembered (Poems) */}
                  {selectedMoment.poems && selectedMoment.poems.length > 0 && (
                    <motion.div
                      className="mb-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1.5, delay: 0.7 }}
                    >
                      <h3
                        className="text-[14px] italic mb-6"
                        style={{
                          fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                          color: atmosphere.textMuted,
                          letterSpacing: '0.02em',
                          fontWeight: 400,
                          opacity: 0.7,
                          textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                        }}
                      >
                        What the Wind Remembered
                      </h3>
                      <div className="space-y-6">
                        {(language === 'hi' && translatedContent ? translatedContent.poems : selectedMoment.poems).map((poem, i) => {
                          const lines = poem.split(',').map(l => l.trim());
                          return (
                            <motion.div
                              key={i}
                              className="space-y-3"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ 
                                duration: 0.8, 
                                delay: 0.9 + (i * 0.3),
                              }}
                            >
                              {lines.map((line, j) => (
                                <motion.div
                                  key={j}
                                  className="text-lg"
                                  style={{
                                    fontFamily: '"Cormorant Garamond", "EB Garamond", serif',
                                    color: atmosphere.textColor,
                                    lineHeight: '1.8',
                                    fontWeight: 400,
                                    letterSpacing: '0.02em',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                  }}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    duration: 0.6,
                                    delay: 1.1 + (i * 0.3) + (j * 0.2),
                                  }}
                                >
                                  {line}
                                </motion.div>
                              ))}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Ways the Day Could Bloom (Tips) */}
                  {selectedMoment.tips && selectedMoment.tips.length > 0 && (
                    <motion.div
                      className="mb-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 1.5 }}
                    >
                      <h3
                        className="text-[14px] italic mb-6"
                        style={{
                          fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                          color: atmosphere.textMuted,
                          letterSpacing: '0.02em',
                          fontWeight: 400,
                          opacity: 0.7,
                          textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                        }}
                      >
                        Ways the Day Could Bloom 🌸
                      </h3>
                      <div className="space-y-4">
                        {(language === 'hi' && translatedContent ? translatedContent.tips : selectedMoment.tips).map((tip, i) => (
                          <motion.div
                            key={i}
                            className="flex items-start gap-4"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: 1.7 + (i * 0.12),
                            }}
                          >
                            {/* Firefly dot with shimmer */}
                            <motion.div
                              className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: `radial-gradient(circle, ${atmosphere.accentColor} 0%, ${atmosphere.gradient[0]} 100%)`,
                                boxShadow: `0 0 12px ${atmosphere.accentColor}80`,
                              }}
                              animate={{
                                opacity: [0.6, 1, 0.6],
                                scale: [1, 1.3, 1],
                                boxShadow: [
                                  `0 0 12px ${atmosphere.accentColor}60`,
                                  `0 0 20px ${atmosphere.accentColor}90`,
                                  `0 0 12px ${atmosphere.accentColor}60`,
                                ],
                              }}
                              transition={{
                                duration: 2 + Math.random(),
                                repeat: Infinity,
                                delay: i * 0.3,
                              }}
                            />
                            <span
                              className="text-[15px] flex-1"
                              style={{
                                fontFamily: '"Inter", -apple-system, sans-serif',
                                color: atmosphere.textColor,
                                lineHeight: '1.8',
                                fontWeight: 400,
                                letterSpacing: '0.02em',
                                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              }}
                            >
                              {tip}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Song Recommendations (1960-1975 Era) - Curated Gift */}
                  {(() => {
                    const songs = selectedMoment.songs;
                    const hasEnUrl = songs?.en?.youtube_url;
                    const hasHiUrl = songs?.hi?.youtube_url;
                    
                    // Don't render if no URLs available
                    if (!hasEnUrl && !hasHiUrl) return null;
                    
                    // Determine which URL to use based on language with fallback
                    const selectedUrl = language === 'hi' ? hasHiUrl : hasEnUrl;
                    const finalUrl = selectedUrl || (language === 'hi' ? hasEnUrl : hasHiUrl);
                    const isFallback = !selectedUrl && !!finalUrl;
                    
                    // Get metadata from the language being displayed
                    const displayLang = selectedUrl ? language : (language === 'hi' ? 'en' : 'hi');
                    const title = songs?.[displayLang]?.title;
                    const artist = songs?.[displayLang]?.artist;
                    const year = songs?.[displayLang]?.year;
                    const why = songs?.[displayLang]?.why;
                    
                    console.log('[MomentsLibrary] Song selection:', {
                      language,
                      hasEnUrl,
                      hasHiUrl,
                      selectedUrl,
                      finalUrl,
                      isFallback,
                      displayLang,
                    });
                    
                    return (
                      <motion.div
                        className="mb-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 1.8 }}
                      >
                        <h3
                          className="text-[14px] italic mb-3"
                          style={{
                            fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                            color: atmosphere.textMuted,
                            letterSpacing: '0.02em',
                            fontWeight: 400,
                            opacity: 0.7,
                            textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                          }}
                        >
                          A song found for your moment 🎵
                        </h3>
                        
                        {/* Fallback notice */}
                        {isFallback && (
                          <motion.div
                            className="text-center mb-4 text-xs italic"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            style={{
                              fontFamily: '"Inter", -apple-system, sans-serif',
                              color: atmosphere.textMuted,
                              opacity: 0.5,
                            }}
                          >
                            We picked the closest match for now.
                          </motion.div>
                        )}
                        
                        {/* YouTube Embedded Player - Glassmorphic Card */}
                        <div className="space-y-6">
                          {/* YouTube Player Card with fade transition */}
                          <motion.div 
                            key={`${language}-${finalUrl}`} // Key ensures fade on language change
                            className="relative rounded-2xl overflow-hidden backdrop-blur-xl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                              boxShadow: `0 8px 32px ${language === 'hi' ? '#f59e0b' : atmosphere.accentColor}25`,
                              background: `linear-gradient(135deg, ${language === 'hi' ? 'rgba(245, 158, 11, 0.08)' : `${atmosphere.accentColor}08`}, rgba(255, 255, 255, 0.02))`,
                              border: `1px solid ${language === 'hi' ? 'rgba(245, 158, 11, 0.2)' : `${atmosphere.accentColor}20`}`,
                            }}
                          >
                            {/* Gradient border glow */}
                            <div 
                              className="absolute inset-0 rounded-2xl opacity-50 pointer-events-none"
                              style={{
                                background: language === 'hi' 
                                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(245, 158, 11, 0.15) 100%)'
                                  : `linear-gradient(135deg, ${atmosphere.accentColor}15 0%, ${atmosphere.gradient[1]}10 50%, ${atmosphere.accentColor}15 100%)`,
                              }}
                            />

                            {/* Optional emotion caption */}
                            {why && (
                              <div
                                className="px-6 pt-4 pb-2 text-xs italic text-center"
                                style={{
                                  fontFamily: '"Inter", -apple-system, sans-serif',
                                  color: atmosphere.textMuted,
                                  opacity: 0.6,
                                  lineHeight: '1.6',
                                }}
                              >
                                {why}
                              </div>
                            )}

                            {/* YouTube iframe embed - lazy loaded */}
                            <div className="relative" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                              <iframe
                                src={(() => {
                                  if (!finalUrl) return '';
                                  // Extract video ID from URL and convert to embed URL
                                  const videoId = finalUrl.includes('watch?v=') 
                                    ? finalUrl.split('watch?v=')[1]?.split('&')[0]
                                    : finalUrl.split('/').pop();
                                  return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&enablejsapi=1`;
                                })()}
                                className="absolute top-0 left-0 w-full h-full rounded-xl"
                                style={{
                                  border: 'none',
                                  filter: 'saturate(1.1) brightness(1.05)',
                                }}
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                loading="lazy"
                                title={title ? `${title} by ${artist}` : 'Song recommendation'}
                                aria-label={title ? `YouTube player — ${title} by ${artist}` : 'YouTube player'}
                                onLoad={(e) => {
                                  // Set up message listener for YouTube player events
                                  const handleYouTubeMessage = (event: MessageEvent) => {
                                    if (event.origin !== 'https://www.youtube.com') return;
                                    
                                    try {
                                      const data = JSON.parse(event.data);
                                      if (data.event === 'infoDelivery' && data.info?.playerState !== undefined) {
                                        const state = data.info.playerState;
                                        // 1 = playing, 2 = paused, 0 = ended
                                        if (state === 1) {
                                          // YouTube is playing - mute ambient
                                          const { stopAmbientSound } = require('@/lib/sound');
                                          stopAmbientSound();
                                          console.log('[MomentsLibrary] YouTube playing - muted ambient');
                                        } else if (state === 2 || state === 0) {
                                          // YouTube paused or ended - resume ambient
                                          const { playAmbientSound, isMuted } = require('@/lib/sound');
                                          if (!isMuted()) {
                                            playAmbientSound();
                                            console.log('[MomentsLibrary] YouTube paused/ended - resumed ambient');
                                          }
                                        }
                                      }
                                    } catch {}
                                  };
                                  
                                  window.addEventListener('message', handleYouTubeMessage);
                                  
                                  // Request player state updates
                                  const iframe = e.currentTarget as HTMLIFrameElement;
                                  iframe.contentWindow?.postMessage('{"event":"listening","id":"1"}', '*');
                                }}
                              />
                            </div>
                          </motion.div>
                          
                          {/* Song metadata - refined with glassmorphism */}
                          {(title || artist) && (
                            <motion.div 
                              key={`metadata-${language}-${finalUrl}`}
                              className="text-center p-4 rounded-xl backdrop-blur-sm"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, delay: 0.1 }}
                              style={{
                                background: `linear-gradient(135deg, ${atmosphere.accentColor}05, transparent)`,
                              }}
                            >
                              {title && (
                                <div
                                  className="text-lg font-medium"
                                  style={{
                                    fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                                    color: atmosphere.textColor,
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {title}
                                </div>
                              )}
                              {(artist || year) && (
                                <div
                                  className="text-sm mt-1"
                                  style={{
                                    fontFamily: '"Inter", -apple-system, sans-serif',
                                    color: atmosphere.textMuted,
                                    opacity: 0.7,
                                  }}
                                >
                                  {artist}{year ? ` • ${year}` : ''}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* Closing line - whisper appearing at the bottom with firefly glyphs */}
                  {selectedMoment.closingLine && (
                    <motion.div
                      className="mt-10 pt-8 border-t flex items-center justify-center gap-3"
                      style={{ borderColor: `${atmosphere.accentColor}30` }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1.2, delay: 0.8, ease: EASING }}
                    >
                      {/* Floating firefly glyph (left) */}
                      <motion.span
                        className="text-sm"
                        style={{ 
                          filter: `drop-shadow(0 0 6px ${atmosphere.accentGlow})`,
                          opacity: 0.6,
                        }}
                        animate={{
                          opacity: [0.5, 1, 0.5],
                          scale: [1, 1.2, 1],
                          y: [0, -4, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        ✨
                      </motion.span>
                      
                      <motion.p
                        className="text-[15px] italic text-center max-w-md"
                        style={{
                          fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                          color: atmosphere.textColor,
                          fontWeight: 400,
                          letterSpacing: '0.02em',
                          lineHeight: '1.8',
                          opacity: 0.7,
                          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        }}
                      >
                        {language === 'hi' && translatedContent ? translatedContent.closingLine : selectedMoment.closingLine}
                      </motion.p>
                      
                      {/* Floating firefly glyph (right) */}
                      <motion.span
                        className="text-sm"
                        style={{ 
                          filter: `drop-shadow(0 0 6px ${atmosphere.accentGlow})`,
                          opacity: 0.6,
                        }}
                        animate={{
                          opacity: [0.5, 1, 0.5],
                          scale: [1, 1.2, 1],
                          y: [0, -4, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: 1.5,
                        }}
                      >
                        ✨
                      </motion.span>
                    </motion.div>
                  )}
                </div>
                </div> {/* Close inner wrapper for backgrounds */}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Guest mode CTA - Save Moments */}
      <AnimatePresence>
        {status === 'unauthenticated' && phase === 'library' && !selectedMoment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full shadow-xl border border-pink-200"
            style={{
              padding: '1.5rem',
              maxWidth: '400px',
            }}
          >
            <p className="text-sm font-serif text-pink-800 mb-2 text-center">
              {pigName ? `${pigName} whispers: your moments are fleeting…` : 'Your moments are fleeting…'}
            </p>
            <button
              onClick={() => signIn('google')}
              className="w-full bg-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
            >
              Save Moments
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { getZone, type PrimaryEmotion } from '@/lib/zones';

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
}

interface MomentsLibraryProps {
  pigId: string;
  pigName: string;
  currentPrimary: PrimaryEmotion; // Today's zone to start with
  onNewReflection: () => void;
}

const EASING = [0.65, 0, 0.35, 1] as const;

// Tower configuration with corrected zone labels
// MAPPING: joyful→Vera, powerful→Ashmere, peaceful→Haven, sad→Vanta, scared→Vire, mad→Sable
// ZONE LABELS: Vera (Joyful), Ashmere (Powerful), Haven (Peaceful), Vanta (Sad), Vire (Fearful), Sable (Angry)
const TOWER_CONFIGS = [
  { id: 'joyful' as PrimaryEmotion, name: 'Vera', label: 'Joyful', color: '#FFD700', x: 8, height: 180 },
  { id: 'powerful' as PrimaryEmotion, name: 'Ashmere', label: 'Powerful', color: '#FF6B35', x: 22, height: 220 },
  { id: 'peaceful' as PrimaryEmotion, name: 'Haven', label: 'Peaceful', color: '#6A9FB5', x: 38, height: 160 },
  { id: 'sad' as PrimaryEmotion, name: 'Vanta', label: 'Sad', color: '#7D8597', x: 54, height: 200 },
  { id: 'scared' as PrimaryEmotion, name: 'Vire', label: 'Fearful', color: '#5A189A', x: 70, height: 190 },
  { id: 'mad' as PrimaryEmotion, name: 'Sable', label: 'Angry', color: '#C1121F', x: 86, height: 170 },
];

export default function MomentsLibrary({
  pigId,
  pigName,
  currentPrimary,
  onNewReflection,
}: MomentsLibraryProps) {
  const [phase, setPhase] = useState<'intro' | 'skyline' | 'library'>('intro');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  const [hoveredTower, setHoveredTower] = useState<PrimaryEmotion | null>(null);
  const [visibleTowers, setVisibleTowers] = useState<Set<PrimaryEmotion>>(new Set([currentPrimary]));
  const [isLoading, setIsLoading] = useState(true);
  const [blinkingWindow, setBlinkingWindow] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const leoRef = useRef<HTMLDivElement>(null);

  // Log component mount
  useEffect(() => {
    console.log('[MomentsLibrary] 🎬 Component mounted!', { pigId, pigName, currentPrimary });
  }, []);

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
                    
                    return (
                      <motion.div
                        key={windowKey}
                        className="rounded-[1px] cursor-pointer relative group"
                        style={{ cursor: 'pointer' }}
                        animate={{
                          backgroundColor: isBlinking 
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
                          boxShadow: isBlinking
                            ? [
                                `0 0 8px rgba(255, 230, 200, 0.4)`,
                                `0 0 25px rgba(255, 230, 200, 0.9), 0 4px 30px rgba(255, 230, 200, 0.6)`,
                                `0 0 8px rgba(255, 230, 200, 0.4)`,
                              ]
                            : `0 0 0px transparent`,
                        }}
                        transition={{
                          duration: isBlinking ? 0.8 : 2 + Math.random() * 2,
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
                      className="absolute -top-24 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: isHovered ? 1 : 0.9,
                        y: 0,
                      }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      {/* Tower name - large serif italic with hover glow */}
                      <motion.div
                        className="font-serif italic text-4xl font-bold pointer-events-none mb-1"
                        style={{
                          color: tower.color,
                          textShadow: isHovered
                            ? `
                                0 0 50px ${tower.color},
                                0 0 100px ${tower.color},
                                0 0 150px ${tower.color},
                                0 2px 12px rgba(0,0,0,0.3)
                              `
                            : `
                                0 0 40px ${tower.color},
                                0 0 80px ${tower.color},
                                0 0 120px ${tower.color},
                                0 2px 12px rgba(0,0,0,0.3)
                              `,
                        }}
                      >
                        {tower.name}
                      </motion.div>
                      
                      {/* Zone label - fades in on hover */}
                      <motion.div
                        className="text-sm font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          fontFamily: '"Inter", -apple-system, sans-serif',
                          color: tower.color,
                          textShadow: `0 1px 8px rgba(0,0,0,0.2)`,
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

      {/* Title - lowered slightly for better balance, sequential fade-in */}
      <AnimatePresence>
        {phase === 'library' && (
          <>
            {/* Main Title */}
            <motion.div
              className="absolute top-16 md:top-20 left-0 right-0 z-30 text-center pointer-events-none px-4"
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
            
            {/* Subtitle - layered reveal after title */}
            <motion.div
              className="absolute top-28 md:top-36 left-0 right-0 z-30 text-center pointer-events-none px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: EASING }}
            >
              <p
                className="text-sm sm:text-base md:text-lg"
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  color: '#5A4962',
                  fontWeight: 400,
                  letterSpacing: '0.03em',
                }}
              >
                Each window holds a breath you once shared.
              </p>
            </motion.div>

            {/* Share a New Moment Icon - top-left */}
            <motion.button
              className="fixed top-4 left-4 z-50 pointer-events-auto rounded-full overflow-hidden group"
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
                width: '48px',
                height: '48px',
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
                  className="text-2xl"
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

      {/* Moment Detail Modal */}
      <AnimatePresence>
        {selectedMoment && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMoment(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            
            {/* Modal Card */}
            <motion.div
              className="relative max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.4, ease: EASING }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 240, 245, 0.95) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div className="p-8">
                {/* Close button */}
                <button
                  onClick={() => setSelectedMoment(null)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/50 hover:bg-white/80 transition-all"
                  aria-label="Close"
                >
                  <span className="text-2xl text-gray-600">×</span>
                </button>

                {/* Timestamp */}
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                  {new Date(selectedMoment.timestamp).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>

                {/* Primary Emotion Badge */}
                <div className="flex items-center gap-2 mb-6">
                  <div
                    className="px-4 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: `${getTowerConfig(selectedMoment.zone)?.color}40`,
                      color: getTowerConfig(selectedMoment.zone)?.color,
                    }}
                  >
                    {selectedMoment.primaryEmotion}
                  </div>
                  {selectedMoment.secondary && (
                    <div className="text-sm text-gray-600">
                      → {selectedMoment.secondary}
                    </div>
                  )}
                </div>

                {/* Reflection Text */}
                <div className="mb-8">
                  <h3
                    className="text-2xl mb-4"
                    style={{
                      fontFamily: '"EB Garamond", "Georgia", serif',
                      color: '#3A263F',
                      lineHeight: '1.4',
                    }}
                  >
                    {selectedMoment.text}
                  </h3>
                  
                  {/* Invoked/Expressed */}
                  {selectedMoment.invoked && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">What triggered it:</span> {selectedMoment.invoked}
                    </div>
                  )}
                  {selectedMoment.expressed && (
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">How it showed:</span> {selectedMoment.expressed}
                    </div>
                  )}
                </div>

                {/* Poems */}
                {selectedMoment.poems && selectedMoment.poems.length > 0 && (
                  <div className="mb-8">
                    <h4
                      className="text-lg mb-4"
                      style={{
                        fontFamily: '"EB Garamond", "Georgia", serif',
                        color: '#5A4962',
                      }}
                    >
                      Leo's Reflection
                    </h4>
                    <div className="space-y-4">
                      {selectedMoment.poems.map((poem, i) => {
                        const lines = poem.split(',').map(l => l.trim());
                        return (
                          <div
                            key={i}
                            className="italic text-gray-700 leading-relaxed"
                            style={{
                              fontFamily: '"EB Garamond", "Georgia", serif',
                              fontSize: '1.1rem',
                            }}
                          >
                            {lines.map((line, j) => (
                              <div key={j}>{line}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {selectedMoment.tips && selectedMoment.tips.length > 0 && (
                  <div>
                    <h4
                      className="text-lg mb-4"
                      style={{
                        fontFamily: '"EB Garamond", "Georgia", serif',
                        color: '#5A4962',
                      }}
                    >
                      Gentle Nudges
                    </h4>
                    <ul className="space-y-3">
                      {selectedMoment.tips.map((tip, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-gray-700"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            fontSize: '0.95rem',
                          }}
                        >
                          <span className="text-pink-400 mt-1">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

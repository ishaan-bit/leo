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
  const [showIntroBubble, setShowIntroBubble] = useState(false);
  
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
                      className="absolute -top-24 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: isHovered ? 1 : 0.9,
                        y: 0,
                      }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      {/* Tower name - large serif italic with hover glow, centered */}
                      <motion.div
                        className="font-serif italic text-4xl font-bold pointer-events-none mb-1 text-center w-full"
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
                        className="text-sm font-medium px-3 py-1 rounded-full inline-block"
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

      {/* Title - lowered slightly for better balance, sequential fade-in */}
      <AnimatePresence>
        {phase === 'library' && (
          <>
            {/* Main Title */}
            <motion.div
              className="absolute top-16 md:top-20 left-0 right-0 z-20 text-center pointer-events-none px-4"
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
            
            {/* Subtitle - layered reveal after title, enhanced visibility */}
            <motion.div
              className="absolute top-28 md:top-36 left-0 right-0 z-20 text-center pointer-events-none px-4"
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

      {/* Moment Detail Modal - Redesigned as Emotional Atmosphere */}
      <AnimatePresence>
        {selectedMoment && (() => {
          // Emotion-based atmosphere configuration
          const atmosphereConfig = {
            sad: {
              gradient: ['#B2C1E0', '#C8D2EB', '#E2E8F6'],
              header: "The sky hung heavy with quiet remembering.",
              ambientMotion: 'drizzle',
              textColor: '#6B7A99',
            },
            joyful: {
              gradient: ['#FCE9A0', '#FFD985', '#FFF2C1'],
              header: "The day gleamed with open laughter.",
              ambientMotion: 'motes',
              textColor: '#9B7E3A',
            },
            powerful: {
              gradient: ['#C3E3C2', '#A4D4A2', '#E6F4E5'],
              header: "The ground beneath you hummed steady and sure.",
              ambientMotion: 'pulse',
              textColor: '#4A7A48',
            },
            mad: {
              gradient: ['#F7B2A1', '#F7C5AF', '#FDE6D8'],
              header: "The air crackled with restless thunder.",
              ambientMotion: 'flicker',
              textColor: '#A0523D',
            },
            peaceful: {
              gradient: ['#DAD8F0', '#EAE8F8', '#F8F7FB'],
              header: "Stillness gathered like a soft mist over your heart.",
              ambientMotion: 'mist',
              textColor: '#6B6482',
            },
            scared: {
              gradient: ['#D2B8E5', '#E4D3F0', '#F5EFFF'],
              header: "A hush crept along the edges of your light.",
              ambientMotion: 'heartbeat',
              textColor: '#7D5F96',
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
              />
              
              {/* Modal Card - Glass-like window pane */}
              <motion.div
                className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto"
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
                style={{
                  background: `linear-gradient(135deg, 
                    ${atmosphere.gradient[0]}15 0%, 
                    ${atmosphere.gradient[1]}08 50%, 
                    ${atmosphere.gradient[2]}05 100%)`,
                  backdropFilter: 'blur(40px)',
                  borderRadius: '32px',
                  border: `2px solid ${atmosphere.gradient[0]}40`,
                  boxShadow: `
                    0 0 0 1px ${atmosphere.gradient[0]}20,
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255,255,255,0.4)
                  `,
                }}
              >
                {/* Breathing glow pulse on edges */}
                <motion.div
                  className="absolute inset-0 pointer-events-none rounded-[32px]"
                  style={{
                    boxShadow: `0 0 40px ${atmosphere.gradient[0]}60`,
                  }}
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Ambient motion particles based on emotion */}
                <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
                  {atmosphere.ambientMotion === 'drizzle' && Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={`drizzle-${i}`}
                      className="absolute w-[1px] bg-gradient-to-b from-transparent via-blue-300/30 to-transparent"
                      style={{
                        left: `${Math.random() * 100}%`,
                        height: `${20 + Math.random() * 40}px`,
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
                  
                  {atmosphere.ambientMotion === 'motes' && Array.from({ length: 30 }).map((_, i) => (
                    <motion.div
                      key={`mote-${i}`}
                      className="absolute w-1 h-1 rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${atmosphere.gradient[1]} 0%, transparent 70%)`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
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
                  
                  {atmosphere.ambientMotion === 'mist' && Array.from({ length: 5 }).map((_, i) => (
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
                </div>

                <div className="relative p-10" style={{ lineHeight: '1.7' }}>
                  {/* Close button - floating mote style */}
                  <motion.button
                    onClick={() => setSelectedMoment(null)}
                    className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full transition-all z-10"
                    style={{
                      background: `linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))`,
                      boxShadow: `0 4px 16px ${atmosphere.gradient[0]}40`,
                    }}
                    whileHover={{ 
                      scale: 1.1,
                      boxShadow: `0 6px 24px ${atmosphere.gradient[0]}60`,
                    }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close"
                  >
                    <span className="text-2xl" style={{ color: atmosphere.textColor }}>×</span>
                  </motion.button>

                  {/* Atmospheric Header */}
                  <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                  >
                    <motion.h2
                      className="text-2xl md:text-3xl italic mb-3"
                      style={{
                        fontFamily: '"EB Garamond", "Georgia", serif',
                        color: atmosphere.textColor,
                        fontWeight: 500,
                        textShadow: `0 2px 12px ${atmosphere.gradient[0]}60`,
                      }}
                      animate={{
                        opacity: [0.9, 1, 0.9],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      {atmosphere.header}
                    </motion.h2>
                    
                    {/* Timestamp whisper */}
                    <div 
                      className="text-xs uppercase tracking-widest opacity-50"
                      style={{
                        fontFamily: '"Inter", -apple-system, sans-serif',
                        color: atmosphere.textColor,
                        letterSpacing: '0.15em',
                      }}
                    >
                      {new Date(selectedMoment.timestamp).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </motion.div>

                  {/* User's Original Reflection */}
                  <motion.div
                    className="mb-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                  >
                    <div 
                      className="text-xs italic mb-3 opacity-60"
                      style={{
                        fontFamily: '"Inter", -apple-system, sans-serif',
                        color: atmosphere.textColor,
                        letterSpacing: '0.05em',
                      }}
                    >
                      You wrote:
                    </div>
                    <p
                      className="text-xl md:text-2xl leading-relaxed"
                      style={{
                        fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                        color: atmosphere.textColor,
                        fontWeight: 400,
                      }}
                    >
                      {selectedMoment.text}
                    </p>
                  </motion.div>

                  {/* Emotional Anatomy */}
                  <motion.div
                    className="mb-10 space-y-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    {selectedMoment.invoked && (
                      <motion.div
                        className="pl-6 border-l-2"
                        style={{ borderColor: `${atmosphere.gradient[0]}40` }}
                        whileHover={{
                          borderColor: `${atmosphere.gradient[0]}80`,
                          x: 4,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <div 
                          className="text-[0.7rem] uppercase tracking-widest mb-2 opacity-50"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            letterSpacing: '0.12em',
                          }}
                        >
                          What stirred the air
                        </div>
                        <div
                          className="text-base leading-relaxed"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            opacity: 0.85,
                          }}
                        >
                          {selectedMoment.invoked}
                        </div>
                      </motion.div>
                    )}
                    
                    {selectedMoment.expressed && (
                      <motion.div
                        className="pl-6 border-l-2"
                        style={{ borderColor: `${atmosphere.gradient[0]}40` }}
                        whileHover={{
                          borderColor: `${atmosphere.gradient[0]}80`,
                          x: 4,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <div 
                          className="text-[0.7rem] uppercase tracking-widest mb-2 opacity-50"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            letterSpacing: '0.12em',
                          }}
                        >
                          How it lingered in you
                        </div>
                        <div
                          className="text-base leading-relaxed"
                          style={{
                            fontFamily: '"Inter", -apple-system, sans-serif',
                            color: atmosphere.textColor,
                            opacity: 0.85,
                          }}
                        >
                          {selectedMoment.expressed}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* What the Wind Remembered (Poems) */}
                  {selectedMoment.poems && selectedMoment.poems.length > 0 && (
                    <motion.div
                      className="mb-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1.5, delay: 0.7 }}
                    >
                      <h3
                        className="text-lg italic mb-6 opacity-70"
                        style={{
                          fontFamily: '"EB Garamond", "Georgia", serif',
                          color: atmosphere.textColor,
                          letterSpacing: '0.02em',
                        }}
                      >
                        What the Wind Remembered
                      </h3>
                      <div className="space-y-6">
                        {selectedMoment.poems.map((poem, i) => {
                          const lines = poem.split(',').map(l => l.trim());
                          return (
                            <motion.div
                              key={i}
                              className="space-y-2"
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
                                  className="text-lg leading-relaxed"
                                  style={{
                                    fontFamily: '"Cormorant Garamond", "EB Garamond", serif',
                                    color: atmosphere.textColor,
                                    opacity: 0.9,
                                  }}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 0.9, y: 0 }}
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 1.5 }}
                    >
                      <h3
                        className="text-lg italic mb-5 opacity-70"
                        style={{
                          fontFamily: '"EB Garamond", "Georgia", serif',
                          color: atmosphere.textColor,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Ways the Day Could Bloom 🌸
                      </h3>
                      <div className="space-y-4">
                        {selectedMoment.tips.map((tip, i) => (
                          <motion.div
                            key={i}
                            className="flex items-start gap-4"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: 1.7 + (i * 0.15),
                            }}
                          >
                            {/* Firefly dot */}
                            <motion.div
                              className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: `radial-gradient(circle, ${atmosphere.gradient[1]} 0%, ${atmosphere.gradient[0]} 100%)`,
                                boxShadow: `0 0 12px ${atmosphere.gradient[0]}80`,
                              }}
                              animate={{
                                opacity: [0.6, 1, 0.6],
                                scale: [1, 1.3, 1],
                              }}
                              transition={{
                                duration: 2 + Math.random(),
                                repeat: Infinity,
                                delay: i * 0.3,
                              }}
                            />
                            <span
                              className="text-base leading-relaxed flex-1"
                              style={{
                                fontFamily: '"Inter", -apple-system, sans-serif',
                                color: atmosphere.textColor,
                                opacity: 0.85,
                              }}
                            >
                              {tip}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Closing line if present */}
                  {selectedMoment.closingLine && (
                    <motion.div
                      className="mt-10 pt-8 border-t"
                      style={{ borderColor: `${atmosphere.gradient[0]}20` }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 2 }}
                    >
                      <p
                        className="text-base italic text-center"
                        style={{
                          fontFamily: '"EB Garamond", "Georgia", serif',
                          color: atmosphere.textColor,
                          opacity: 0.7,
                        }}
                      >
                        {selectedMoment.closingLine}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

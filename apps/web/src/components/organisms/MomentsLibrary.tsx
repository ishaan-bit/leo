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

type GroupBy = 'zones' | 'all';
type SortBy = 'newest' | 'oldest';

const EASING = [0.65, 0, 0.35, 1] as const;

// Tower configuration with zone-specific styling
// Heights in viewport units (vh) - min 60vh, max 80vh
// Zone mappings: Vire=joy, Ashmere=sadness, Vera=fear, Haven=trust, Sable=anger, Vanta=disgust
const TOWER_CONFIGS = [
  { 
    id: 'joy' as PrimaryEmotion, 
    name: 'Vire',
    x: 12, 
    heightVh: 65, // 0.65 ratio
    color: '#FFD58A', // Warm golden
    style: 'smooth-crown', // Smooth crown top
    auraIntensity: 1.2 // Extra warm glow
  },
  { 
    id: 'sadness' as PrimaryEmotion, 
    name: 'Ashmere',
    x: 25, 
    heightVh: 80, // 0.8 ratio - tallest, narrow
    color: '#B4A6FF', // Soft purple
    style: 'narrow-tall', // Narrow tall
    auraIntensity: 0.8 // Calm fade
  },
  { 
    id: 'fear' as PrimaryEmotion, 
    name: 'Vera',
    x: 40, 
    heightVh: 75, // 0.75 ratio
    color: '#9FE3E3', // Aqua translucent
    style: 'angular-bevel', // Angular bevel
    auraIntensity: 0.7 // Translucent glass effect
  },
  { 
    id: 'trust' as PrimaryEmotion, 
    name: 'Haven',
    x: 55, 
    heightVh: 60, // 0.6 ratio
    color: '#EED2FF', // Soft lavender
    style: 'dome-top', // Dome top
    auraIntensity: 1.0 // Halo ring
  },
  { 
    id: 'anger' as PrimaryEmotion, 
    name: 'Sable',
    x: 70, 
    heightVh: 70, // 0.7 ratio
    color: '#FFB28F', // Warm terracotta
    style: 'stepped', // Stepped
    auraIntensity: 0.9 // Faint ember flicker
  },
  { 
    id: 'disgust' as PrimaryEmotion, 
    name: 'Vanta',
    x: 85, 
    heightVh: 78, // 0.78 ratio
    color: '#6C78FF', // Deep blue
    style: 'solid-prism', // Solid prism
    auraIntensity: 1.1 // Slow pulsing aura
  },
];

export default function MomentsLibrary({
  pigId,
  pigName,
  currentPrimary,
  onNewReflection,
}: MomentsLibraryProps) {
  const [phase, setPhase] = useState<'intro' | 'skyline' | 'library'>('intro');
  const [groupBy, setGroupBy] = useState<GroupBy>('zones');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  const [hoveredTower, setHoveredTower] = useState<PrimaryEmotion | null>(null);
  const [visibleTowers, setVisibleTowers] = useState<Set<PrimaryEmotion>>(new Set([currentPrimary]));
  const [isLoading, setIsLoading] = useState(true);
  
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

  // Group moments by zone
  const momentsByZone = moments.reduce((acc, moment) => {
    if (!acc[moment.zone]) acc[moment.zone] = [];
    acc[moment.zone].push(moment);
    return acc;
  }, {} as Record<PrimaryEmotion, Moment[]>);

  // Sort moments
  const sortMoments = (momentsToSort: Moment[]) => {
    return [...momentsToSort].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
  };

  // Get moment count for a tower
  const getMomentCount = (zone: PrimaryEmotion) => {
    return momentsByZone[zone]?.length || 0;
  };

  // Get tower config
  const getTowerConfig = (zone: PrimaryEmotion) => {
    return TOWER_CONFIGS.find(t => t.id === zone);
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 overflow-hidden">
      {/* Sky background - warm lavender to peach dawn gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #5E4B7E 0%, #8B6A9E 25%, #CFA8E0 50%, #E8C5D9 75%, #FAD2D6 100%)',
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
      
      {/* Stars with parallax and random twinkling */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 150 }).map((_, i) => {
          const size = Math.random() > 0.7 ? 2 : 1;
          const twinkleDuration = 2 + Math.random() * 3;
          const twinleDelay = Math.random() * 4;
          
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
              }}
              transition={{
                duration: twinkleDuration,
                repeat: Infinity,
                delay: twinleDelay,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </div>

      {/* Leo - floating below title, centered relative to skyline */}
      <motion.div
        ref={leoRef}
        className="absolute z-40"
        initial={{ left: '50%', top: '40%', x: '-50%', y: '-50%', scale: 1 }}
        animate={
          phase === 'library'
            ? { left: '50%', top: '16%', x: '-50%', y: '0%', scale: 0.7 }
            : { left: '50%', top: '40%', x: '-50%', y: '-50%', scale: 1 }
        }
        transition={{ duration: 1.2, ease: EASING }}
      >
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
            <Image src="/images/leo.svg" alt="Leo" width={160} height={160} priority />
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
              className="absolute bottom-0 cursor-pointer"
              style={{
                left: `${tower.x}%`,
                width: '100px',
                height: `${tower.heightVh}vh`,
                transform: 'translateX(-50%)', // Center on X position
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
              {/* Tower aura glow */}
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${tower.color}${Math.round(tower.auraIntensity * 204).toString(16).padStart(2, '0')} 0%, ${tower.color}66 50%, transparent 100%)`,
                  filter: `blur(${30 * tower.auraIntensity}px)`,
                }}
                animate={{
                  opacity: isHovered ? tower.auraIntensity : (tower.auraIntensity * 0.6),
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  opacity: { duration: 0.3 },
                  scale: { duration: 3 + (tower.auraIntensity * 0.5), repeat: Infinity, ease: 'easeInOut' },
                }}
              />

              {/* Tower body with opacity gradient: dark base → light top */}
              <div
                className="w-full h-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}80 0%, ${tower.color}50 50%, ${tower.color}30 100%)`,
                  border: `1px solid ${tower.color}60`,
                  borderRadius: tower.style === 'smooth-crown' ? '8px 8px 0 0'
                    : tower.style === 'dome-top' ? '50% 50% 0 0 / 20% 20% 0 0'
                    : tower.style === 'angular-bevel' ? '0 0 0 0'
                    : '2px 2px 0 0',
                  boxShadow: `inset 0 -40px 60px ${tower.color}20`,
                }}
              >
                {/* Windows - representing actual moments with zone-colored glow */}
                {/* REDESIGN: Larger, more visible windows stacked vertically like floors */}
                <div className="absolute inset-4 flex flex-col gap-3 justify-end">
                  {momentsByZone[tower.id]?.slice(0, 12).map((moment, i) => {
                    const windowDelay = i * 0.15;
                    const breathCycleDuration = 6; // 6s breathing cycle
                    
                    // Calculate recency (newer = brighter)
                    const momentAge = Date.now() - new Date(moment.timestamp).getTime();
                    const daysSinceReflection = momentAge / (1000 * 60 * 60 * 24);
                    const recencyBrightness = Math.max(0.4, 1 - (daysSinceReflection / 30)); // Dim over 30 days
                    
                    return (
                      <motion.div
                        key={`window-${tower.id}-${moment.id}`}
                        className="rounded-md cursor-pointer relative group"
                        style={{
                          width: '100%',
                          height: '24px', // 2x bigger - more visible
                          boxShadow: `0 0 12px ${tower.color}90`,
                          border: `1.5px solid ${tower.color}60`,
                        }}
                        animate={{
                          backgroundColor: [
                            `${tower.color}${Math.round(50 * recencyBrightness).toString(16).padStart(2, '0')}`,
                            `${tower.color}${Math.round(95 * recencyBrightness).toString(16).padStart(2, '0')}`,
                            `${tower.color}${Math.round(50 * recencyBrightness).toString(16).padStart(2, '0')}`,
                          ],
                          opacity: [0.5 * recencyBrightness, 0.9 * recencyBrightness, 0.5 * recencyBrightness],
                          boxShadow: [
                            `0 0 8px ${tower.color}50`,
                            `0 0 20px ${tower.color}CC`,
                            `0 0 8px ${tower.color}50`,
                          ],
                        }}
                        transition={{
                          duration: breathCycleDuration,
                          repeat: Infinity,
                          delay: windowDelay,
                          ease: 'easeInOut',
                        }}
                        whileHover={{
                          scale: 1.15,
                          opacity: 1,
                          zIndex: 10,
                          boxShadow: `0 0 30px ${tower.color}FF`,
                        }}
                        onClick={() => setSelectedMoment(moment)}
                      >
                        {/* Window tooltip on hover */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-xs text-gray-800 max-w-xs">
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

                {/* Tower label - using custom tower names */}
                <AnimatePresence>
                  {phase === 'library' && isVisible && (
                    <motion.div
                      className="absolute -bottom-10 left-0 right-0 text-center pointer-events-none"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      <div
                        className="text-xs uppercase tracking-wider"
                        style={{
                          color: tower.color,
                          fontFamily: '"Inter", -apple-system, sans-serif',
                          fontVariant: 'small-caps',
                          fontWeight: 600,
                          textShadow: `0 0 12px ${tower.color}60`,
                        }}
                      >
                        {tower.name}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tooltip on hover */}
                <AnimatePresence>
                  {isHovered && phase === 'library' && (
                    <motion.div
                      className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="text-sm text-gray-800">
                        {momentCount > 0
                          ? `${momentCount} moment${momentCount !== 1 ? 's' : ''} in ${zone?.name}`
                          : 'No moments here yet'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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

      {/* Title & Controls */}
      <AnimatePresence>
        {phase === 'library' && (
          <>
            {/* Title - EB Garamond, centered below Leo */}
            <motion.div
              className="absolute top-28 left-0 right-0 z-30 text-center pointer-events-none"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: EASING }}
            >
              <h1
                className="text-5xl md:text-6xl mb-3"
                style={{
                  fontFamily: '"EB Garamond", "Georgia", serif',
                  fontWeight: 500,
                  color: '#3A263F',
                  textShadow: '0 2px 20px rgba(58, 38, 63, 0.2)',
                  letterSpacing: '0.02em',
                }}
              >
                Your Moments
              </h1>
              <p
                className="text-base md:text-lg"
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

            {/* Controls - moved up, styled with Inter SemiBold */}
            <motion.div
              className="absolute top-56 left-1/2 -translate-x-1/2 z-30 flex gap-4 pointer-events-auto"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              {/* Group By */}
              <div className="bg-white/15 backdrop-blur-md rounded-full px-5 py-2.5 flex gap-3 items-center shadow-lg">
                <span 
                  className="text-xs uppercase tracking-wider"
                  style={{
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    letterSpacing: '0.08em',
                  }}
                >
                  Group by
                </span>
                <button
                  onClick={() => setGroupBy('zones')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    groupBy === 'zones'
                      ? 'bg-white/30 text-white'
                      : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                  }`}
                >
                  Zones
                </button>
                <button
                  onClick={() => setGroupBy('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    groupBy === 'all'
                      ? 'bg-white/30 text-white'
                      : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
              </div>

              {/* Sort By */}
              <div className="bg-white/15 backdrop-blur-md rounded-full px-5 py-2.5 flex gap-3 items-center shadow-lg">
                <span 
                  className="text-xs uppercase tracking-wider"
                  style={{
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    letterSpacing: '0.08em',
                  }}
                >
                  Sort by
                </span>
                <button
                  onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/20 text-white hover:bg-white/30 transition-all"
                >
                  {sortBy === 'newest' ? 'Newest ↓' : 'Oldest ↑'}
                </button>
              </div>
            </motion.div>

            {/* New Breath Button - gradient pink→purple with sparkle and glow */}
            <motion.button
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
              onClick={onNewReflection}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ 
                scale: 1.05,
                filter: 'brightness(1.1) drop-shadow(0 0 20px rgba(224, 123, 224, 0.6))',
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.6, delay: 1 }}
              style={{
                background: 'linear-gradient(135deg, #E07BE0 0%, #B57BE0 50%, #8A64F9 100%)',
                boxShadow: '0 8px 32px rgba(138, 100, 249, 0.3)',
              }}
            >
              <div className="px-8 py-3.5 rounded-full flex items-center gap-2">
                <span className="text-xl">✨</span>
                <span 
                  className="text-white text-sm tracking-wide"
                  style={{
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  Take a New Breath
                </span>
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

      {/* Empty State */}
      {!isLoading && phase === 'library' && moments.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div 
              className="text-3xl mb-4 italic"
              style={{
                fontFamily: '"EB Garamond", "Georgia", serif',
                color: '#5A4962',
                textShadow: '0 2px 10px rgba(90, 73, 98, 0.3)',
              }}
            >
              Your city is waiting to light up.
            </div>
            <div 
              className="text-lg"
              style={{
                fontFamily: '"Inter", -apple-system, sans-serif',
                color: '#8A7999',
              }}
            >
              Share your first breath to begin.
            </div>
          </div>
        </div>
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
    </div>
  );
}

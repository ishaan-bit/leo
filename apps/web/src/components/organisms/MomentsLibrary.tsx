'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { getZone, type PrimaryEmotion } from '@/lib/zones';

interface Moment {
  id: string;
  text: string;
  zone: PrimaryEmotion;
  timestamp: string;
  excerpt: string;
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

// Tower configuration matching breathing sequence
const TOWER_CONFIGS = [
  { id: 'joy' as PrimaryEmotion, x: 15, height: 180, color: '#F8D8B5' },
  { id: 'trust' as PrimaryEmotion, x: 28, height: 220, color: '#D4C5F9' },
  { id: 'fear' as PrimaryEmotion, x: 41, height: 160, color: '#B8C5D6' },
  { id: 'surprise' as PrimaryEmotion, x: 54, height: 200, color: '#F4C2C2' },
  { id: 'sadness' as PrimaryEmotion, x: 67, height: 140, color: '#C8D5E0' },
  { id: 'disgust' as PrimaryEmotion, x: 80, height: 240, color: '#A8B5C0' },
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

  // Fetch moments from API
  useEffect(() => {
    const fetchMoments = async () => {
      try {
        // TODO: Replace with actual API endpoint
        const response = await fetch(`/api/pig/${pigId}/moments`);
        if (response.ok) {
          const data = await response.json();
          setMoments(data.moments || []);
        }
      } catch (error) {
        console.error('[MomentsLibrary] Error fetching moments:', error);
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
      {/* Sky background - same pink gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #2D1B3D, #4A2B5C, #8B5A8D, #D4A5C4, #FFE5F0)',
        }}
        animate={{
          scale: phase === 'skyline' ? 0.92 : 1,
        }}
        transition={{ duration: 1.5, ease: EASING }}
      />
      
      {/* Stars with parallax */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 70}%`,
            }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Leo - floating in corner during library phase */}
      <motion.div
        ref={leoRef}
        className="absolute z-40"
        initial={{ left: '50%', top: '35%', x: '-50%', y: '-50%', scale: 1 }}
        animate={
          phase === 'library'
            ? { left: '12%', top: '15%', x: '0%', y: '0%', scale: 0.85 }
            : { left: '50%', top: '35%', x: '-50%', y: '-50%', scale: 1 }
        }
        transition={{ duration: 1, ease: EASING }}
      >
        <motion.div
          animate={{
            y: [0, -8, 0],
            rotate: [0, 2, 0, -2, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Image src="/images/leo.svg" alt="Leo" width={170} height={170} priority />
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
              {/* Tower aura glow */}
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${zone?.color}CC 0%, ${zone?.color}66 50%, transparent 100%)`,
                  filter: 'blur(30px)',
                }}
                animate={{
                  opacity: isHovered ? 1 : 0.6,
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  opacity: { duration: 0.3 },
                  scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                }}
              />

              {/* Tower body */}
              <div
                className="w-full h-full relative"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  border: `1px solid ${tower.color}40`,
                  borderRadius: '2px 2px 0 0',
                }}
              >
                {/* Windows - representing moments */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.min(momentCount, 24) }).map((_, i) => (
                    <motion.div
                      key={`window-${tower.id}-${i}`}
                      className="rounded-[1px]"
                      animate={{
                        backgroundColor: [
                          `rgba(248, 216, 181, ${isVisible ? 0.15 : 0.05})`,
                          `rgba(255, 230, 200, ${isVisible ? 0.5 : 0.1})`,
                          `rgba(248, 216, 181, ${isVisible ? 0.15 : 0.05})`,
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

                {/* Tower label */}
                <AnimatePresence>
                  {phase === 'library' && isVisible && (
                    <motion.div
                      className="absolute -bottom-8 left-0 right-0 text-center pointer-events-none"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      <div
                        className="text-xs uppercase tracking-wider"
                        style={{
                          color: zone?.color,
                          fontVariant: 'small-caps',
                          fontWeight: 500,
                          textShadow: `0 0 8px ${zone?.color}40`,
                        }}
                      >
                        {zone?.name}
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
            {/* Title */}
            <motion.div
              className="absolute top-24 left-0 right-0 z-30 text-center pointer-events-none"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: EASING }}
            >
              <h1
                className="text-4xl md:text-5xl mb-2 italic"
                style={{
                  fontFamily: '"EB Garamond", "Georgia", serif',
                  color: '#FFF9FB',
                  textShadow: '0 2px 12px rgba(156, 31, 95, 0.3)',
                }}
              >
                Your Moments
              </h1>
              <p
                className="text-sm md:text-base"
                style={{
                  fontFamily: '-apple-system, sans-serif',
                  color: '#FFE5F0',
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                }}
              >
                Each window holds a breath you once shared.
              </p>
            </motion.div>

            {/* Controls */}
            <motion.div
              className="absolute top-48 left-1/2 -translate-x-1/2 z-30 flex gap-4 pointer-events-auto"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              {/* Group By */}
              <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 items-center">
                <span className="text-xs text-white/70 uppercase tracking-wide">Group by</span>
                <button
                  onClick={() => setGroupBy('zones')}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    groupBy === 'zones'
                      ? 'bg-white/30 text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  Zones
                </button>
                <button
                  onClick={() => setGroupBy('all')}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    groupBy === 'all'
                      ? 'bg-white/30 text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  All
                </button>
              </div>

              {/* Sort By */}
              <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 items-center">
                <span className="text-xs text-white/70 uppercase tracking-wide">Sort by</span>
                <button
                  onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                  className="px-3 py-1 rounded-full text-xs bg-white/20 text-white hover:bg-white/30 transition-all"
                >
                  {sortBy === 'newest' ? 'Newest ↓' : 'Oldest ↑'}
                </button>
              </div>
            </motion.div>

            {/* New Breath Button */}
            <motion.button
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
              onClick={onNewReflection}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <div className="bg-gradient-to-br from-pink-400 to-purple-500 px-6 py-3 rounded-full shadow-2xl">
                <span className="text-white font-medium text-sm tracking-wide">
                  ✨ Take a New Breath
                </span>
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && phase === 'library' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="text-white text-lg italic">Loading your moments...</div>
        </div>
      )}
    </div>
  );
}

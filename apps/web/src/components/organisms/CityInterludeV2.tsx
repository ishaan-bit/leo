/**
 * CityInterlude v2 - Orchestrated Stage 1 Transition
 * 
 * Timeline-driven ambient scene that waits for backend enrichment,
 * then triggers cinematic zoom to primary emotion tower.
 * 
 * Uses StageOrchestrator for clean state management.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { StageOrchestrator, type WillcoxPrimary, type TowerMapping } from '@/lib/stage-orchestrator';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';

interface CityInterludeV2Props {
  reflectionId: string;
  onComplete: (primary: WillcoxPrimary, tower: TowerMapping) => void;
  onTimeout?: () => void;
}

// Timeline constants
const PULSING_DURATION = 12000; // 12s of pulsating towers before zoom can trigger
const ZOOM_DURATION = 8000;     // 8s cinematic zoom sequence

const TOWERS: Array<{id: WillcoxPrimary; name: string; color: string; x: number; height: number}> = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 200 },
  { id: 'powerful', name: 'Vanta', color: '#FF6B35', x: 28, height: 240 },
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 44, height: 180 },
  { id: 'sad', name: 'Ashmere', color: '#7D8597', x: 56, height: 220 },
  { id: 'mad', name: 'Vire', color: '#C1121F', x: 70, height: 210 },
  { id: 'scared', name: 'Sable', color: '#5A189A', x: 85, height: 190 },
];

export default function CityInterludeV2({
  reflectionId,
  onComplete,
  onTimeout,
}: CityInterludeV2Props) {
  // Orchestrator instance
  const orchestratorRef = useRef<StageOrchestrator | null>(null);
  
  // UI state
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3 | 4 | 5>(1); // 1-3: text, 4: skyline, 5: zoom
  const [isZooming, setIsZooming] = useState(false);
  const [selectedTower, setSelectedTower] = useState<WillcoxPrimary | null>(null);
  const [pulsingComplete, setPulsingComplete] = useState(false);

  // Poll backend for enrichment
  const { reflection, error } = useEnrichmentStatus(reflectionId, {
    enabled: true,
    pollInterval: 3500,
    onTimeout,
  });

  // Initialize orchestrator
  useEffect(() => {
    const orchestrator = new StageOrchestrator(reflectionId);
    orchestratorRef.current = orchestrator;

    // Subscribe to zoom trigger
    const unsubscribeZoom = orchestrator.onZoom((primary, tower) => {
      console.log(`[CityInterlude] 🎬 Zoom callback fired: ${primary} → ${tower.name}`);
      setIsZooming(true);
      setSelectedTower(primary);

      // After zoom animation completes, call onComplete
      setTimeout(() => {
        onComplete(primary, tower);
      }, ZOOM_DURATION);
    });

    return () => {
      unsubscribeZoom();
    };
  }, [reflectionId, onComplete]);

  // Watch backend for primary
  useEffect(() => {
    const primary = reflection?.final?.wheel?.primary;
    
    if (primary && orchestratorRef.current) {
      console.log(`[CityInterlude] 📡 Backend primary detected: ${primary}`);
      orchestratorRef.current.setPrimary(primary);
    }
  }, [reflection]);

  // Text phase timeline (phases 1-3: 30s total before skyline)
  useEffect(() => {
    const phase1Timer = setTimeout(() => setCurrentPhase(2), 8000);  // 8s
    const phase2Timer = setTimeout(() => setCurrentPhase(3), 18000); // +10s = 18s
    const phase3Timer = setTimeout(() => setCurrentPhase(4), 30000); // +12s = 30s → show skyline
    
    return () => {
      clearTimeout(phase1Timer);
      clearTimeout(phase2Timer);
      clearTimeout(phase3Timer);
    };
  }, []);

  // Text content for phases 1-3
  const phaseText = {
    1: "Your reflection is being processed...",
    2: "Finding the right words...",
    3: "Almost ready...",
  };

  // Skyline pulsing timeline (phase 4: 12s after skyline appears)
  useEffect(() => {
    if (currentPhase === 4) {
      const timer = setTimeout(() => {
        console.log(`[CityInterlude] ⏱️  Pulsing timeline complete`);
        setPulsingComplete(true);
        
        if (orchestratorRef.current) {
          orchestratorRef.current.markPulsingComplete();
        }
      }, PULSING_DURATION);

      return () => clearTimeout(timer);
    }
  }, [currentPhase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#0A0714] to-[#2B2357]">
      
      {/* Text phases 1-3 (before skyline) */}
      {currentPhase >= 1 && currentPhase <= 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.p
            key={currentPhase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8 }}
            className="font-display text-3xl text-dusk-lavender/80 px-8 text-center"
          >
            {phaseText[currentPhase as 1 | 2 | 3]}
          </motion.p>
        </motion.div>
      )}

      {/* City skyline with 6 towers (phase 4+) */}
      {currentPhase >= 4 && (
        <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '50vh' }}
        animate={isZooming && selectedTower ? {
          scale: [1, 2.5],
          y: [0, '-30%'],
        } : {}}
        transition={{
          duration: ZOOM_DURATION / 1000,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {TOWERS.map((tower, idx) => {
          const isPrimary = selectedTower === tower.id;
          const fadeOut = isZooming && !isPrimary;

          return (
            <motion.div
              key={tower.id}
              className="absolute bottom-0"
              style={{
                left: `${tower.x}%`,
                width: '80px',
                height: `${tower.height}px`,
              }}
              initial={{ y: 40, opacity: 0 }}
              animate={{
                y: 0,
                opacity: fadeOut ? 0.15 : 1,
              }}
              transition={{
                y: { duration: 2, delay: idx * 0.3, ease: 'easeOut' },
                opacity: { duration: isZooming ? 2 : 0.5 },
              }}
            >
              {/* Tower body */}
              <div
                className="w-full h-full relative overflow-hidden rounded-t-sm"
                style={{
                  background: `linear-gradient(180deg, ${tower.color}50 0%, ${tower.color}25 60%, ${tower.color}15 100%)`,
                  boxShadow: isPrimary && isZooming
                    ? `0 0 60px ${tower.color}A0, inset 0 -30px 50px ${tower.color}40`
                    : `0 0 20px ${tower.color}20`,
                  border: `1px solid ${tower.color}40`,
                }}
              >
                {/* Pulsating windows */}
                <div className="absolute inset-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.floor(tower.height / 25) * 4 }).map((_, i) => (
                    <motion.div
                      key={`window-${tower.id}-${i}`}
                      className="bg-white/0 rounded-[1px]"
                      animate={{
                        backgroundColor: pulsingComplete
                          ? [
                              `rgba(248, 216, 181, 0.15)`,
                              `rgba(255, 230, 200, 0.5)`,
                              `rgba(248, 216, 181, 0.15)`,
                            ]
                          : `rgba(248, 216, 181, 0.1)`,
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: idx * 0.5 + i * 0.1,
                        ease: [0.45, 0.05, 0.55, 0.95],
                      }}
                    />
                  ))}
                </div>

                {/* Tower name (visible when primary during zoom) */}
                {isPrimary && isZooming && (
                  <motion.div
                    className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-serif italic"
                    style={{
                      color: tower.color,
                      textShadow: `0 0 15px ${tower.color}`,
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, scale: [1, 1.3] }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                  >
                    {tower.name}
                  </motion.div>
                )}

                {/* Halo (emerges during zoom) */}
                {isPrimary && isZooming && (
                  <motion.div
                    className="absolute -top-24 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${tower.color}60 0%, transparent 70%)`,
                      filter: 'blur(20px)',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 0.8, 1],
                      scale: [0, 1.3, 1],
                    }}
                    transition={{
                      duration: 3,
                      delay: 4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      )}

      {/* Status indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <motion.p
          className="text-sm text-white/40 font-serif italic"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {!pulsingComplete && 'The city breathes...'}
          {pulsingComplete && !isZooming && 'Awaiting signal...'}
          {isZooming && selectedTower && `Approaching ${TOWERS.find(t => t.id === selectedTower)?.name}...`}
        </motion.p>
      </div>

      {/* Debug overlay (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 text-xs text-white/60 font-mono bg-black/40 p-2 rounded">
          <div>RID: {reflectionId.slice(0, 20)}...</div>
          <div>Pulsing: {pulsingComplete ? '✅' : '⏳'}</div>
          <div>Primary: {reflection?.final?.wheel?.primary || '⏳'}</div>
          <div>Zooming: {isZooming ? '🎬' : '⏸️ '}</div>
        </div>
      )}
    </div>
  );
}

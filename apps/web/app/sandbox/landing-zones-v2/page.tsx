'use client';

/**
 * Landing Zones v2: Living Atmospheres
 * Enhanced demo with breathing animations, atmospheric elements, and rich interactions
 * 
 * Features:
 * - JSON input form (same as v1)
 * - Vertical split with primary (top) and secondary (bottom) zones
 * - Each zone breathes independently with pulse-driven animations
 * - Ambient sync mode: zones pulse in alternating rhythm
 * - Global gradient overlay for smooth color transitions
 * - Debug overlay (toggleable)
 * - 60fps performance, mobile-first
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildZones } from '@/lib/landing-zone/rules';
import LandingZone from '@/components/molecules/LandingZone';
import type { EmotionKey } from '@/content/regions';

type ViewState = 'input' | 'zones';

// Sample JSON for quick testing
const SAMPLE_JSON = {
  rid: 'refl_test_v2',
  final: {
    invoked: "['fatigue', 'irritation', 'low_progress']",
    expressed: "[]",
    wheel: {
      primary: 'sadness',
      secondary: 'anger',
    },
    valence: -0.3,
    arousal: 0.4,
    confidence: 0.75,
  },
};

export default function LandingZonesV2() {
  const [view, setView] = useState<ViewState>('input');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [zones, setZones] = useState<ReturnType<typeof buildZones> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [expandedZone, setExpandedZone] = useState<'A' | 'B' | null>(null);
  const [ambientSyncMode, setAmbientSyncMode] = useState(true);

  const handleBuildZones = () => {
    try {
      setError(null);
      const parsed = JSON.parse(jsonInput);
      const { invoked, expressed, wheel, valence, arousal, confidence } = parsed.final;

      // Parse Python-style stringified arrays
      const invokedArray = JSON.parse(invoked.replace(/'/g, '"'));
      const expressedArray = JSON.parse(expressed.replace(/'/g, '"'));

      const enrichment = {
        primary: wheel.primary as EmotionKey,
        secondary: wheel.secondary as EmotionKey,
        valence,
        arousal,
        confidence,
        invoked: invokedArray,
        expressed: expressedArray,
      };

      const [zoneA, zoneB] = buildZones(enrichment);
      setZones([zoneA, zoneB]);
      setView('zones');

      // Telemetry
      console.log('🌅 Landing Zones v2 Built:', {
        zoneA: { emotion: zoneA.emotion, subTone: zoneA.subTone, arousal: zoneA.arousal },
        zoneB: { emotion: zoneB.emotion, subTone: zoneB.subTone, arousal: zoneB.arousal },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON');
    }
  };

  const handleZoneTap = (zoneId: 'A' | 'B') => {
    setExpandedZone(expandedZone === zoneId ? null : zoneId);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <AnimatePresence mode="wait">
        {view === 'input' && (
          <motion.div
            key="input"
            className="flex flex-col items-center justify-center min-h-screen p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-full max-w-3xl">
              <h1 className="font-serif text-4xl md:text-5xl font-light text-white text-center mb-8">
                Landing Zones v2
              </h1>
              <p className="font-sans text-sm text-white/60 text-center mb-8">
                Living Atmospheres · Breathing Animations · Mobile-First
              </p>

              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-4">
                <label className="block font-sans text-sm text-white/80 mb-2">
                  Enrichment JSON
                </label>
                <textarea
                  className="w-full h-64 bg-slate-900/50 border border-white/10 rounded-lg p-4 font-mono text-sm text-white focus:outline-none focus:border-white/30 resize-none"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <p className="font-mono text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg py-4 font-sans text-sm font-medium text-white transition-all duration-300"
                onClick={handleBuildZones}
              >
                Build Zones
              </button>
            </div>
          </motion.div>
        )}

        {view === 'zones' && zones && (
          <motion.div
            key="zones"
            className="relative min-h-screen w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            {/* Global gradient overlay between zones */}
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                background: `linear-gradient(to bottom, 
                  ${zones[0].palette.bg}00 0%,
                  ${zones[0].palette.fg}20 40%,
                  ${zones[1].palette.fg}20 60%,
                  ${zones[1].palette.bg}00 100%)`,
                opacity: 0.3,
              }}
            />

            {/* Zone A (Primary - Top) */}
            <LandingZone
              zone={zones[0]}
              phaseOffset={0}
              isExpanded={expandedZone === 'A'}
              onTap={() => handleZoneTap('A')}
            />

            {/* Zone B (Secondary - Bottom) - offset pulse by 15-20% */}
            {expandedZone !== 'A' && (
              <LandingZone
                zone={zones[1]}
                phaseOffset={ambientSyncMode ? 0.18 : 0}
                isExpanded={expandedZone === 'B'}
                onTap={() => handleZoneTap('B')}
              />
            )}

            {/* Debug overlay */}
            {showDebug && (
              <motion.div
                className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 bg-black/80 backdrop-blur-md rounded-lg p-4 font-mono text-xs text-white/80 z-50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Debug Info</span>
                  <button
                    onClick={() => setShowDebug(false)}
                    className="text-white/60 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1">
                  <div>Zone A: {zones[0].emotion} · {zones[0].subTone}</div>
                  <div>Zone B: {zones[1].emotion} · {zones[1].subTone}</div>
                  <div>Arousal: {zones[0].arousal.toFixed(2)} / {zones[1].arousal.toFixed(2)}</div>
                  <div>Valence: {zones[0].valence.toFixed(2)} / {zones[1].valence.toFixed(2)}</div>
                  <div>Motion: {zones[0].symbol.motion} / {zones[1].symbol.motion}</div>
                  <div>Sound: {zones[0].sound.layer}·{zones[0].sound.density} / {zones[1].sound.layer}·{zones[1].sound.density}</div>
                  <div className="pt-2 border-t border-white/20">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ambientSyncMode}
                        onChange={(e) => setAmbientSyncMode(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs">Ambient Sync (18% offset)</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Controls */}
            <motion.div
              className="fixed top-4 left-4 z-50 flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                onClick={() => setView('input')}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full px-4 py-2 font-sans text-xs text-white transition-all duration-300"
              >
                ← Edit JSON
              </button>
              {!showDebug && (
                <button
                  onClick={() => setShowDebug(true)}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full px-4 py-2 font-sans text-xs text-white transition-all duration-300"
                >
                  Debug
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

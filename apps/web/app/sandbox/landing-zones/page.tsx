'use client';

/**
 * Landing Zone Demo - Paste enrichment JSON and see split-screen
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildZones, type Zone } from '@/lib/landing-zone/rules';
import SymbolRenderer from '@/components/atoms/SymbolRenderer';
import type { EmotionKey } from '@/content/regions';

type ViewState = "input" | "intro" | "idle" | "choosing" | "expanding" | "handoff";

// Sample JSON for quick testing
const SAMPLE_JSON = {
  "rid": "refl_1760945609962_tdf2x1l5r",
  "final": {
    "invoked": "['fatigue', 'irritation', 'low_progress']",
    "expressed": "[]",
    "wheel": {
      "primary": "sadness",
      "secondary": "anticipation"
    },
    "valence": 0.5,
    "arousal": 0.5,
    "confidence": 0.75
  }
};

export default function LandingZonePage() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [view, setView] = useState<ViewState>("input");
  const [zones, setZones] = useState<[Zone, Zone] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null);
  const [dwellStart, setDwellStart] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const handleLoad = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Extract enrichment data
      const final = parsed.final || parsed;
      
      // Parse invoked/expressed (they're stringified arrays)
      let invoked: string[] = [];
      let expressed: string[] = [];
      
      if (typeof final.invoked === 'string') {
        // Parse Python-style list string: "['fatigue', 'irritation']"
        invoked = final.invoked
          .replace(/[\[\]']/g, '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(final.invoked)) {
        invoked = final.invoked;
      }
      
      if (typeof final.expressed === 'string' && final.expressed.length > 2) {
        expressed = final.expressed
          .replace(/[\[\]']/g, '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(final.expressed)) {
        expressed = final.expressed;
      }

      const enrichment = {
        primary: final.wheel.primary as EmotionKey,
        secondary: final.wheel.secondary as EmotionKey,
        invoked,
        expressed,
        valence: final.valence,
        arousal: final.arousal,
        confidence: final.confidence,
      };

      const builtZones = buildZones(enrichment);
      setZones(builtZones);
      setError("");
      
      // Start intro sequence
      setView("intro");
      setTimeout(() => {
        setView("idle");
        setDwellStart(Date.now());
      }, 800);
      
      // Log impression
      console.log('[landing_zone_impression]', {
        rid: parsed.rid,
        primary: enrichment.primary,
        secondary: enrichment.secondary,
        timestamp: new Date().toISOString(),
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleChoose = (index: 0 | 1) => {
    if (!zones) return;
    
    setSelectedIndex(index);
    setView("choosing");
    
    const dwellMs = Date.now() - dwellStart;
    const chosen = zones[index];
    
    // Log choice
    console.log('[landing_zone_chosen]', {
      event: 'landing_zone_chosen',
      chosen_zone: chosen.id,
      chosen_emotion: chosen.emotion,
      dwell_ms: dwellMs,
      timestamp: new Date().toISOString(),
    });
    
    // Animate expansion
    setTimeout(() => {
      setView("expanding");
      setTimeout(() => {
        setView("handoff");
        alert(`Chosen: ${chosen.regionName}\nOil: ${chosen.oilLabel}\nCaption: ${chosen.caption}`);
      }, 1500);
    }, 400);
  };

  if (view === "input" || error || !zones) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-serif">🌸 Landing Zones Sandbox</h1>
          <p className="text-gray-400">Paste enrichment JSON below</p>
          
          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded px-4 py-3 text-red-200">
              {error}
            </div>
          )}
          
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-96 bg-gray-800 text-gray-100 font-mono text-sm p-4 rounded border border-gray-700 focus:border-pink-500 focus:outline-none"
            placeholder="Paste enrichment JSON here..."
          />
          
          <div className="flex gap-4">
            <button
              onClick={handleLoad}
              className="px-6 py-3 bg-pink-600 hover:bg-pink-700 rounded font-medium transition-colors"
            >
              Load Split Screen
            </button>
            
            <button
              onClick={() => setJsonInput(JSON.stringify(SAMPLE_JSON, null, 2))}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
            >
              Reset to Sample
            </button>
          </div>
          
          <details className="text-sm text-gray-400 mt-8">
            <summary className="cursor-pointer hover:text-gray-300">Expected JSON structure</summary>
            <pre className="mt-2 bg-gray-800 p-4 rounded overflow-x-auto">
{`{
  "rid": "...",
  "final": {
    "invoked": "['fatigue', 'irritation']",  // or array
    "expressed": "[]",                        // or array
    "wheel": {
      "primary": "sadness",
      "secondary": "anticipation"
    },
    "valence": 0.5,
    "arousal": 0.5,
    "confidence": 0.75
  }
}`}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  // Split-screen view
  const [zoneA, zoneB] = zones;
  
  const paneVariants = {
    intro: { opacity: 0, scale: 0.95 },
    idle: { opacity: 0.96, scale: 1 },
    choosing: { opacity: 1, scale: 1.02 },
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <AnimatePresence mode="wait">
        {/* Top Pane - Zone A */}
        <motion.button
          key="zone-a"
          className="flex-1 relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-white/50"
          style={{
            background: `linear-gradient(135deg, ${zoneA.palette.bg} 0%, ${zoneA.palette.glow} 100%)`,
            color: zoneA.palette.fg,
          }}
          variants={paneVariants}
          initial="intro"
          animate={view === "idle" ? "idle" : view === "choosing" && selectedIndex === 0 ? "choosing" : "idle"}
          exit={{ opacity: selectedIndex === 1 ? 0 : 1, y: selectedIndex === 1 ? -100 : 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => handleChoose(0)}
          disabled={view !== "idle"}
          aria-label={`Choose ${zoneA.regionName} (${zoneA.emotion}) — ${zoneA.oilLabel}`}
        >
          {/* Symbol */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30">
            <SymbolRenderer spec={zoneA.symbol} color={zoneA.palette.accent} size={200} />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center space-y-4">
            <h2 className="text-4xl font-serif italic tracking-wide">{zoneA.regionName}</h2>
            <p className="text-lg opacity-80">{zoneA.oilLabel}</p>
            <p className="text-2xl font-light mt-6">{zoneA.caption}</p>
          </div>
          
          {/* Accent shimmer on hover */}
          <motion.div
            className="absolute inset-0 opacity-0 hover:opacity-10 transition-opacity pointer-events-none"
            style={{ background: zoneA.palette.accent }}
          />
        </motion.button>

        {/* Bottom Pane - Zone B */}
        <motion.button
          key="zone-b"
          className="flex-1 relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-white/50"
          style={{
            background: `linear-gradient(135deg, ${zoneB.palette.bg} 0%, ${zoneB.palette.glow} 100%)`,
            color: zoneB.palette.fg,
          }}
          variants={paneVariants}
          initial="intro"
          animate={view === "idle" ? "idle" : view === "choosing" && selectedIndex === 1 ? "choosing" : "idle"}
          exit={{ opacity: selectedIndex === 0 ? 0 : 1, y: selectedIndex === 0 ? 100 : 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => handleChoose(1)}
          disabled={view !== "idle"}
          aria-label={`Choose ${zoneB.regionName} (${zoneB.emotion}) — ${zoneB.oilLabel}`}
        >
          {/* Symbol */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30">
            <SymbolRenderer spec={zoneB.symbol} color={zoneB.palette.accent} size={200} />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center space-y-4">
            <h2 className="text-4xl font-serif italic tracking-wide">{zoneB.regionName}</h2>
            <p className="text-lg opacity-80">{zoneB.oilLabel}</p>
            <p className="text-2xl font-light mt-6">{zoneB.caption}</p>
          </div>
          
          {/* Accent shimmer on hover */}
          <motion.div
            className="absolute inset-0 opacity-0 hover:opacity-10 transition-opacity pointer-events-none"
            style={{ background: zoneB.palette.accent }}
          />
        </motion.button>
      </AnimatePresence>
      
      {/* Debug overlay */}
      <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded font-mono max-w-xs">
        <div>View: {view}</div>
        <div>Zone A: {zoneA.emotion} ({zoneA.subTone})</div>
        <div>Zone B: {zoneB.emotion} ({zoneB.subTone})</div>
        <div>Sound A: {zoneA.sound.layer}/{zoneA.sound.tempo} (density {zoneA.sound.density})</div>
        <div>Sound B: {zoneB.sound.layer}/{zoneB.sound.tempo} (density {zoneB.sound.density})</div>
      </div>
    </div>
  );
}

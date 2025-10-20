/**
 * Emotional Landing Zones - Region/Oil/Palette/Sound Mappings
 * Source: Emotional Landing Zones Spec (Oct 20, 2025)
 */

export type EmotionKey =
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "disgust"
  | "surprise"
  | "trust"
  | "anticipation";

export type Palette = {
  bg: string;
  fg: string;
  accent: string;
  glow: string;
};

export type SoundDesign = {
  layer: "pads" | "shimmer" | "wood" | "wind";
  tempo: "slow" | "mid" | "steady";
  density: 0 | 1 | 2;
};

export type SymbolKind =
  | "orb"
  | "spire"
  | "vine"
  | "dune"
  | "wave"
  | "ember"
  | "veil"
  | "ray";

export type SymbolMotion = "pulse" | "drift" | "ripple" | "sway" | "bloom";

export type SymbolSpec = {
  kind: SymbolKind;
  motion: SymbolMotion;
};

// Region Names (canonical)
export const EMOTION_TO_REGION: Record<EmotionKey, { name: string; symbol: SymbolKind }> = {
  joy: { name: "The Valley of Renewal", symbol: "vine" },
  sadness: { name: "The Lake of Quiet", symbol: "wave" },
  anger: { name: "The Ember Forge", symbol: "ember" },
  fear: { name: "The Veil of Pines", symbol: "veil" },
  disgust: { name: "The Salt Flats", symbol: "dune" },
  surprise: { name: "The Rayfields", symbol: "ray" },
  trust: { name: "The Hearthplain", symbol: "orb" },
  anticipation: { name: "The Windward Steps", symbol: "spire" },
};

// Oil Bottle Labels (canonical blends)
export const EMOTION_TO_OIL: Record<EmotionKey, string> = {
  joy: "Citrus + Neroli",
  sadness: "Sandal + Rain",
  anger: "Cedar + Vetiver",
  fear: "Pine + Frankincense",
  disgust: "Sage + Salt",
  surprise: "Ginger + Bergamot",
  trust: "Rosemary + Lavender",
  anticipation: "Peppermint + Juniper",
};

// Palettes
export const EMOTION_TO_PALETTE: Record<EmotionKey, Palette> = {
  joy: { bg: "#F7F1E3", fg: "#2E2A25", accent: "#F1B24A", glow: "#FFDFAA" },
  sadness: { bg: "#0E2238", fg: "#E7F1FA", accent: "#6AAED6", glow: "#9BC7E6" },
  anger: { bg: "#1E0B0A", fg: "#F5EDEB", accent: "#D6462E", glow: "#FF7A66" },
  fear: { bg: "#0D1A14", fg: "#EAF2ED", accent: "#3C6F5A", glow: "#79B69B" },
  disgust: { bg: "#1A1E14", fg: "#EDEFE3", accent: "#84936B", glow: "#BFD3A0" },
  surprise: { bg: "#11151C", fg: "#F0F6FF", accent: "#67B7FF", glow: "#B1DAFF" },
  trust: { bg: "#171417", fg: "#F6F2F6", accent: "#A182C2", glow: "#CAB5E2" },
  anticipation: { bg: "#0F1823", fg: "#EEF3FA", accent: "#4FA3C4", glow: "#9FD6E8" },
};

// Sound Design Defaults (modulated by arousal)
export const EMOTION_TO_SOUND: Record<EmotionKey, SoundDesign> = {
  joy: { layer: "pads", tempo: "mid", density: 1 },
  sadness: { layer: "wind", tempo: "slow", density: 0 },
  anger: { layer: "wood", tempo: "steady", density: 2 },
  fear: { layer: "wind", tempo: "slow", density: 1 },
  disgust: { layer: "wood", tempo: "slow", density: 1 },
  surprise: { layer: "shimmer", tempo: "mid", density: 2 },
  trust: { layer: "pads", tempo: "slow", density: 0 },
  anticipation: { layer: "shimmer", tempo: "steady", density: 1 },
};

// Symbol motion defaults (can be overridden by arousal)
export const SYMBOL_MOTION_DEFAULTS: Record<SymbolKind, SymbolMotion> = {
  orb: "pulse",
  spire: "drift",
  vine: "sway",
  dune: "drift",
  wave: "ripple",
  ember: "pulse",
  veil: "sway",
  ray: "bloom",
};

// Plutchik opposites for auto-composing secondary
export const EMOTION_OPPOSITES: Record<EmotionKey, EmotionKey> = {
  joy: "sadness",
  sadness: "joy",
  anger: "fear",
  fear: "anger",
  trust: "disgust",
  disgust: "trust",
  surprise: "anticipation",
  anticipation: "surprise",
};

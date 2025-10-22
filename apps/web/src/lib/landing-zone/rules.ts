/**
 * Landing Zone Rules Engine
 * Implements caption generation, subTone selection, and zone building
 */

import {
  EmotionKey,
  EMOTION_TO_REGION,
  EMOTION_TO_OIL,
  EMOTION_TO_PALETTE,
  EMOTION_TO_SOUND,
  SYMBOL_MOTION_DEFAULTS,
  type Palette,
  type SoundDesign,
  type SymbolSpec,
} from "@/content/regions";

export type SubTone = "soothe" | "steady" | "lift" | "focus";

export type Zone = {
  id: "A" | "B";
  emotion: EmotionKey;
  regionName: string;
  oilLabel: string;
  palette: Palette;
  sound: SoundDesign;
  symbol: SymbolSpec;
  caption: string;
  subTone: SubTone;
  arousal: number;
  valence: number;
};

export type EnrichmentContext = {
  invoked: string[];
  expressed: string[];
  valence: number;
  arousal: number;
  confidence: number;
};

// Caption templates by subTone
const CAPTION_TEMPLATES: Record<SubTone, [string, string]> = {
  soothe: ["Set the noise down.", "Hold the softer edge."],
  steady: ["Stand inside your strength.", "Let the heat have shape."],
  lift: ["Let light reach you.", "Rise, gently."],
  focus: ["Face what calls you.", "Name the next step."],
};

/**
 * Pick subTone based on invoked/expressed emotions and arousal
 */
export function pickSubTone(
  invoked: string[],
  expressed: string[],
  arousal: number
): SubTone {
  const invokedStr = invoked.join(" ").toLowerCase();
  const expressedStr = expressed.join(" ").toLowerCase();

  // Priority 1: Soothe for anxiety/stress/overwhelm
  if (
    invokedStr.includes("anxiety") ||
    invokedStr.includes("stress") ||
    invokedStr.includes("overwhelm")
  ) {
    return "soothe";
  }

  // Priority 2: Lift for fatigue/apathy
  if (invokedStr.includes("fatigue") || invokedStr.includes("apathy")) {
    return "lift";
  }

  // Priority 3: Steady for irritation/tension/anger
  if (
    expressedStr.includes("irritated") ||
    expressedStr.includes("tense") ||
    expressedStr.includes("angry") ||
    invokedStr.includes("anger") ||
    invokedStr.includes("irritation")
  ) {
    return "steady";
  }

  // Priority 4: Focus for anticipatory/uncertain states
  if (
    invokedStr.includes("anticipation") ||
    invokedStr.includes("uncertain") ||
    expressedStr.includes("anticipat")
  ) {
    return "focus";
  }

  // Tie-break by arousal
  return arousal > 0.5 ? "steady" : "lift";
}

/**
 * Build caption from subTone with confidence modulation
 */
export function buildCaption(
  subTone: SubTone,
  confidence: number,
  alt: boolean = false
): string {
  const [primary, alternative] = CAPTION_TEMPLATES[subTone];
  const chosen = alt ? alternative : primary;

  // Confidence < 0.5 → soften with "Perhaps…"
  if (confidence < 0.5) {
    return `Perhaps… ${chosen.toLowerCase()}`;
  }

  return chosen;
}

/**
 * Build a single Zone from emotion + context
 */
export function buildZone(
  emotion: EmotionKey,
  role: "primary" | "secondary",
  ctx: EnrichmentContext
): Zone {
  const { invoked, expressed, arousal, confidence } = ctx;

  // Get base data from mappings
  const region = EMOTION_TO_REGION[emotion];
  const oilLabel = EMOTION_TO_OIL[emotion];
  const palette = EMOTION_TO_PALETTE[emotion];
  let sound = { ...EMOTION_TO_SOUND[emotion] };

  // Arousal modulation for sound
  if (arousal >= 0.75) {
    sound.density = Math.min(2, sound.density + 1) as 0 | 1 | 2;
  } else if (arousal <= 0.25) {
    sound.density = Math.max(0, sound.density - 1) as 0 | 1 | 2;
  }

  // Symbol with motion
  const symbolKind = region.symbol;
  let symbolMotion = SYMBOL_MOTION_DEFAULTS[symbolKind];

  // Arousal modulation for symbol motion
  if (arousal >= 0.75) {
    symbolMotion = "pulse";
  } else if (arousal <= 0.25) {
    symbolMotion = "drift";
  }

  const symbol: SymbolSpec = {
    kind: symbolKind,
    motion: symbolMotion,
  };

  // Pick subTone
  const subTone = pickSubTone(invoked, expressed, arousal);

  // Build caption (use alt for secondary to avoid duplication)
  const caption = buildCaption(subTone, confidence, role === "secondary");

  return {
    id: role === "primary" ? "A" : "B",
    emotion,
    regionName: region.name,
    oilLabel,
    palette,
    sound,
    symbol,
    caption,
    subTone,
    arousal: ctx.arousal,
    valence: ctx.valence,
  };
}

/**
 * Build both zones from enrichment result
 */
export function buildZones(enrichment: {
  primary: EmotionKey;
  secondary: EmotionKey;
  invoked: string[];
  expressed: string[];
  valence: number;
  arousal: number;
  confidence: number;
}): [Zone, Zone] {
  const ctx: EnrichmentContext = {
    invoked: enrichment.invoked,
    expressed: enrichment.expressed,
    valence: enrichment.valence,
    arousal: enrichment.arousal,
    confidence: enrichment.confidence,
  };

  const zoneA = buildZone(enrichment.primary, "primary", ctx);
  const zoneB = buildZone(enrichment.secondary, "secondary", ctx);

  return [zoneA, zoneB];
}

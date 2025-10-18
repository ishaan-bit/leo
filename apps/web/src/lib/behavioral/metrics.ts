/**
 * Behavioral sensing metrics for Scene_Reflect
 * Extracts affect dimensions from typing and voice patterns
 */

export interface TypingMetrics {
  speedMsPerChar: number[];
  pauseLengths: number[];
  backspaceCount: number;
  totalChars: number;
  pressure?: number[];
}

export interface VoiceMetrics {
  speechRate: number;      // words per second
  pitchRange: number;       // Hz spread
  pauseDensity: number;     // % of silence
  amplitudeVariance: number; // dB delta
}

export interface AffectVector {
  arousal: number;      // 0..1 - energy level
  valence: number;      // -1..1 - mood tone
  cognitiveEffort: number; // 0..1 - mental load
}

/**
 * Calculate arousal from typing speed
 * Fast typing = high arousal, slow typing = low arousal
 */
export function calcArousalFromTyping(metrics: TypingMetrics): number {
  if (metrics.speedMsPerChar.length === 0) return 0.5;
  
  const avgSpeed = metrics.speedMsPerChar.reduce((a, b) => a + b, 0) / metrics.speedMsPerChar.length;
  
  // Normalize: 50ms = high arousal (1.0), 300ms = low arousal (0.0)
  const normalized = 1 - Math.min(Math.max((avgSpeed - 50) / 250, 0), 1);
  
  return normalized;
}

/**
 * Calculate cognitive effort from editing behavior
 * High backspace rate + long pauses = high effort
 */
export function calcCognitiveEffort(metrics: TypingMetrics): number {
  if (metrics.totalChars === 0) return 0.5;
  
  // Backspace ratio
  const backspaceRatio = Math.min(metrics.backspaceCount / metrics.totalChars, 1);
  
  // Pause analysis
  const avgPauseLength = metrics.pauseLengths.length > 0
    ? metrics.pauseLengths.reduce((a, b) => a + b, 0) / metrics.pauseLengths.length
    : 0;
  
  // Long pauses indicate contemplation/effort
  // Normalize: 2000ms = high effort
  const pauseScore = Math.min(avgPauseLength / 2000, 1);
  
  // Combine: backspace weight 0.6, pause weight 0.4
  const effort = (backspaceRatio * 0.6) + (pauseScore * 0.4);
  
  return Math.min(Math.max(effort, 0), 1);
}

/**
 * Calculate arousal from voice metrics
 * Fast speech + high amplitude variance = high arousal
 */
export function calcArousalFromVoice(metrics: VoiceMetrics): number {
  // Speech rate: 2-4 wps = normal, >5 = high arousal
  const rateScore = Math.min(Math.max((metrics.speechRate - 2) / 3, 0), 1);
  
  // Amplitude variance: normalized 0-50 dB
  const ampScore = Math.min(metrics.amplitudeVariance / 50, 1);
  
  // Combine: rate 0.6, amplitude 0.4
  return (rateScore * 0.6) + (ampScore * 0.4);
}

/**
 * Calculate valence from voice metrics
 * High pitch range + low pause density = positive valence
 * Monotone + high pauses = negative valence
 */
export function calcValenceFromVoice(metrics: VoiceMetrics): number {
  // Pitch range: 80+ Hz = expressive (positive)
  const pitchScore = Math.min(metrics.pitchRange / 100, 1);
  
  // Pause density: low = fluent (positive), high = hesitant (negative)
  const pauseScore = 1 - Math.min(metrics.pauseDensity, 1);
  
  // Combine and scale to -1..1
  const valence = ((pitchScore * 0.5) + (pauseScore * 0.5)) * 2 - 1;
  
  return Math.min(Math.max(valence, -1), 1);
}

/**
 * Calculate effort from voice metrics
 * High pause density = high effort
 */
export function calcEffortFromVoice(metrics: VoiceMetrics): number {
  return Math.min(Math.max(metrics.pauseDensity, 0), 1);
}

/**
 * Compose complete affect vector from typing metrics
 */
export function composeAffectFromTyping(metrics: TypingMetrics): AffectVector {
  const arousal = calcArousalFromTyping(metrics);
  const effort = calcCognitiveEffort(metrics);
  
  // Typing doesn't give us strong valence signal
  // Default to neutral with slight positive bias for engagement
  const valence = 0.2;
  
  return {
    arousal: Math.min(Math.max(arousal, 0), 1),
    valence: Math.min(Math.max(valence, -1), 1),
    cognitiveEffort: Math.min(Math.max(effort, 0), 1),
  };
}

/**
 * Compose complete affect vector from voice metrics
 */
export function composeAffectFromVoice(metrics: VoiceMetrics): AffectVector {
  return {
    arousal: calcArousalFromVoice(metrics),
    valence: calcValenceFromVoice(metrics),
    cognitiveEffort: calcEffortFromVoice(metrics),
  };
}

/**
 * Real-time adaptive response mapping
 * Maps affect metrics to visual/audio parameters
 */
export interface AdaptiveResponse {
  ambientWarmth: number;      // 0..1 - audio warmth
  ambientTempo: number;       // 0.8..1.2 - playback rate
  particleSpeed: number;      // 0..1 - visual motion
  lightSaturation: number;    // 0..1 - color intensity
  pigGlow: string;           // color value
}

export function mapAffectToResponse(affect: AffectVector): AdaptiveResponse {
  // Arousal drives tempo and motion
  const tempo = 0.8 + (affect.arousal * 0.4); // 0.8 to 1.2
  const particleSpeed = affect.arousal;
  
  // Valence drives warmth and color
  const warmth = (affect.valence + 1) / 2; // -1..1 → 0..1
  const saturation = 0.5 + (Math.abs(affect.valence) * 0.5); // more extreme = more saturated
  
  // Pig glow color based on valence
  let pigGlow = '#fce7f3'; // pink-100 default
  if (affect.valence > 0.3) {
    pigGlow = '#fed7aa'; // orange-200 - warm/positive
  } else if (affect.valence < -0.3) {
    pigGlow = '#bfdbfe'; // blue-200 - cool/negative
  }
  
  return {
    ambientWarmth: warmth,
    ambientTempo: tempo,
    particleSpeed,
    lightSaturation: saturation,
    pigGlow,
  };
}

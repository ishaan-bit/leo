/**
 * Dream System Type Definitions
 * Ship v1: LLM-less deterministic dream with 3–8 moments
 */

export type DreamKind = 'weekly' | 'reunion';
export type PrimaryEmotion = 'joyful' | 'peaceful' | 'sad' | 'scared' | 'mad' | 'powerful';
export type BeatKind = 'takeoff' | 'drift' | 'moment' | 'resolve';
export type BuildingName = 'Haven' | 'Vera' | 'Lumen' | 'Aster' | 'Ember' | 'Crown';
export type AudioKey = 'Lydian' | 'Ionian' | 'Dorian' | 'Aeolian' | 'Mixolydian' | 'DorianMixo';

/**
 * Stored in user:{id}:dream_state
 */
export interface DreamState {
  lastDreamAt: string | null; // ISO timestamp
  lastDreamType: DreamKind | null;
  lastDreamMomentIds: string[]; // reflection IDs used in last dream
}

/**
 * Beat in the dream timeline (stored in pending_dream.beats)
 */
export interface DreamBeat {
  t: number; // seconds from start
  kind: BeatKind;
  building?: BuildingName;
  momentId?: string; // reflection ID
  line?: string; // templated one-liner
  focus?: BuildingName; // for resolve beat
}

/**
 * Stored in user:{id}:pending_dream (TTL 14d)
 */
export interface PendingDream {
  scriptId: string; // unique identifier like "dream_7k4p"
  kind: DreamKind;
  generatedAt: string; // ISO with offset (Asia/Kolkata)
  expiresAt: string; // ISO with offset
  duration: number; // seconds, default 18
  palette: {
    primary: PrimaryEmotion;
  };
  audioKey: AudioKey;
  opening: string; // opening line based on absence duration
  beats: DreamBeat[];
  usedMomentIds: string[]; // all reflection IDs used in this dream
}

/**
 * Reflection data structure (from Upstash)
 */
export interface ReflectionData {
  rid: string;
  timestamp: string; // ISO timestamp
  text: string; // original user text
  normalized_text: string; // cleaned text for analysis
  final: {
    wheel: {
      primary: PrimaryEmotion;
    };
    valence?: number; // 0-1
    arousal?: number; // 0-1
  };
}

/**
 * Candidate reflection with computed score
 */
export interface ScoredCandidate {
  reflection: ReflectionData;
  baseScore: number; // 0-1
  recencyDecay: number;
  intensity: number;
  novelty: number;
  textRichness: number;
  daysSince: number;
  timeBucket: number; // T0=0, T1=1, T2=2, T3=3, T4=4
}

/**
 * Building configuration mapped to primary emotion
 */
export interface BuildingConfig {
  name: BuildingName;
  primary: PrimaryEmotion;
  colors: {
    base: string;
    accent: string;
    glow: string;
  };
}

/**
 * Copy template for one-liners
 */
export interface CopyTemplate {
  primary: PrimaryEmotion;
  variants: string[]; // {kw} placeholder for keyword
}

/**
 * Timeline segment durations
 */
export interface TimelineConfig {
  duration: number; // total seconds
  takeoff: number;
  drift: number;
  resolve: number;
  coresCount: number; // K
  slotDuration: number; // per core
}

/**
 * Telemetry event payloads
 */
export interface DreamSkippedBuildEvent {
  reason: 'ineligible' | 'pending_exists' | 'sporadic_no' | 'no_data';
  userId: string;
  kind?: DreamKind;
}

export interface DreamBuiltEvent {
  sid: string;
  userId: string;
  kind: DreamKind;
  K: number; // cores count
  primaries_dist: Record<PrimaryEmotion, number>; // count per primary
  time_buckets_dist: Record<number, number>; // count per time bucket
}

export interface DreamPlayStartEvent {
  sid: string;
  K: number;
}

export interface DreamSkippedEvent {
  sid: string;
  t: number; // seconds when skipped
}

export interface DreamCompleteEvent {
  sid: string;
  K: number;
  dwell_min: number; // shortest dwell on any core
  dwell_max: number; // longest dwell on any core
}

export interface DreamCleanupExpiredEvent {
  count: number;
}

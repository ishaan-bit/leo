/**
 * Reflection Data Schema
 * Complete type definitions for Leo reflection storage
 */

/**
 * Typing metrics captured during keyboard input
 */
export type TypingMetrics = {
  total_chars: number;
  total_words: number;
  duration_ms: number;
  wpm: number;
  pauses: number[];              // Pause durations in ms
  avg_pause_ms: number;
  autocorrect_events: number;
  backspace_count: number;
};

/**
 * Voice metrics captured during speech input
 */
export type VoiceMetrics = {
  duration_ms: number;
  confidence_avg: number;
  confidence_min: number;
  silence_gaps_ms: number[];
  word_count: number;
  lang_detected: string;
};

/**
 * Client context information
 */
export type ClientContext = {
  device: 'mobile' | 'tablet' | 'desktop';
  os?: string;
  browser?: string;
  locale?: string;
  timezone?: string;
  viewport?: { width: number; height: number };
};

/**
 * Behavioral signals extracted from input
 */
export type BehavioralSignals = {
  autocorrect?: boolean;
  silence_gaps?: boolean;
  rapid_typing?: boolean;
  hesitation?: boolean;
};

/**
 * Consent flags for data usage
 */
export type ConsentFlags = {
  research: boolean;              // Allow anonymized research use
  audio_retention: boolean;       // Allow raw audio storage (default: false)
};

/**
 * Version tracking for data processing
 */
export type ProcessingVersion = {
  nlp: string;                    // e.g., "1.0.0"
  valence: string;                // e.g., "1.0.0"
  ui: string;                     // e.g., "1.0.0"
};

/**
 * Complete Reflection object (reflection:{rid})
 * TTL: 30 days (2592000 seconds)
 */
export type Reflection = {
  // Core IDs
  rid: string;                    // Unique reflection ID
  sid: string;                    // Session ID
  timestamp: string;              // ISO 8601
  
  // Pig context
  pig_id: string;
  pig_name_snapshot: string | null;
  
  // Content
  raw_text: string;               // Original input (Hindi/English/Hinglish)
  normalized_text: string | null; // Cleaned/normalized version
  lang_detected: string | null;   // 'hi', 'en', 'hi-en'
  
  // Input mode
  input_mode: 'typing' | 'voice';
  typing_summary: TypingMetrics | null;
  voice_summary: VoiceMetrics | null;
  
  // Affect analysis
  valence: number | null;         // -1 to 1 (negative to positive)
  arousal: number | null;         // 0 to 1 (calm to excited)
  confidence: number | null;      // 0 to 1 (model confidence)
  
  // Tags & classification
  tags_auto: string[];            // Auto-generated tags
  tags_user: string[];            // User-added tags
  
  // Behavioral signals
  signals: BehavioralSignals;
  
  // Privacy & consent
  consent_flags: ConsentFlags;
  
  // Context
  client_context: ClientContext;
  
  // User identity (optional)
  user_id: string | null;         // Only if signed in
  owner_id: string;               // 'guest:{sid}' or 'user:{userId}'
  
  // Versioning
  version: ProcessingVersion;
};

/**
 * Reflection draft (reflection:draft:{sid})
 * TTL: 3 hours (10800 seconds)
 * Stores in-progress reflection for autosave
 */
export type ReflectionDraft = {
  sid: string;
  pig_id: string;
  pig_name_snapshot: string | null;
  raw_text: string;
  input_mode: 'typing' | 'voice';
  typing_summary: Partial<TypingMetrics> | null;
  voice_summary: Partial<VoiceMetrics> | null;
  valence_estimate: number | null;
  arousal_estimate: number | null;
  last_updated: string;           // ISO 8601
};

/**
 * Session object (session:{sid})
 * TTL: 7 days (604800 seconds)
 */
export type Session = {
  sid: string;
  created_at: string;             // ISO 8601
  last_active: string;            // ISO 8601
  pig_id: string | null;          // Linked pig (if named)
  user_id: string | null;         // Linked user (if signed in)
  auth_state: 'guest' | 'signed_in'; // Authentication status
  device_fingerprint: string;     // Hashed IP + user agent
  locale: string | null;
  timezone: string | null;
};

/**
 * User cache object (user:{uid})
 * TTL: 30 days (2592000 seconds)
 */
export type User = {
  user_id: string;
  email: string;
  name: string | null;
  provider: string;               // 'google', etc.
  created_at: string;             // ISO 8601
  last_login_at: string;          // ISO 8601
};

/**
 * Pig-session link (pig:session:{sid})
 * TTL: 7 days (604800 seconds)
 */
export type PigSession = {
  sid: string;
  pig_id: string;
  pig_name: string;
  named_at: string;               // ISO 8601
  owner_id: string;               // 'guest:{sid}' or 'user:{userId}'
};

/**
 * Rate limit counter (rl:sid:{sid})
 * TTL: 60 seconds
 */
export type RateLimit = {
  count: number;
  window_start: string;
};

/**
 * Input validation schema for POST /api/reflect
 */
export type ReflectionInput = {
  // Required
  pigId: string;
  originalText?: string;          // For typing mode
  voiceTranscript?: string;       // For voice mode
  inputType: 'notebook' | 'voice';
  timestamp: string;
  
  // Optional
  pigName?: string;
  normalizedText?: string;
  detectedLanguage?: string;
  
  // Metrics
  metrics?: {
    typing?: Partial<TypingMetrics>;
    voice?: Partial<VoiceMetrics>;
  };
  
  // Affect
  affect?: {
    valence?: number;
    arousal?: number;
    cognitiveEffort?: number;
  };
  
  // Context
  deviceInfo?: Partial<ClientContext>;
  
  // Consent
  consentResearch?: boolean;
  consentAudioRetention?: boolean;
};

/**
 * Validation error response
 */
export type ValidationError = {
  error: string;
  code: 'VALIDATION_FAILED';
  details: {
    field: string;
    message: string;
  }[];
};

/**
 * KV operation error response
 */
export type KvError = {
  error: string;
  code: 'KV_WRITE_FAILED' | 'KV_READ_FAILED' | 'KV_CONNECTION_FAILED';
  details: string;
};

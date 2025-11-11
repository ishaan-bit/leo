/**
 * Stage 2 Playback: "Your Moment" Breath Scroll
 * Type definitions for post_enrichment payload
 */

export interface PostEnrichmentPayload {
  /** 3 standalone poems (no comma splitting) - LEGACY, use dialogue_tuples instead */
  poems: [string, string, string];
  
  /** 3 guidance tips - LEGACY, use dialogue_tuples instead */
  tips: string[];
  
  /** Final outro phrase */
  closing_line: string;
  
  /** Tip mood for micro-animations */
  tip_moods?: Array<'peaceful' | 'pride' | 'celebratory'>;
  
  /** NEW: Full 3-part dialogue tuples from Excel
   * Each tuple is [Inner Voice, Regulate, Amuse]
   * - Inner Voice: Floating text above city/skyline
   * - Regulate: Pig speech bubble
   * - Amuse: Window/building bubble
   */
  dialogue_tuples?: Array<[string, string, string]>;
  
  /** Metadata from enrichment */
  meta?: {
    source?: string;
    dialogue_tuples?: Array<[string, string, string]>;
    [key: string]: any;
  };
}

export type Stage2Phase = 
  | 'idle'           // Not started, normal breathing
  | 'continuity'     // Phase 0: handoff, fade in intro text
  | 'poem1'          // Phase 1: ignite window, show poems[0]
  | 'poem2'          // Phase 2: show poems[1]
  | 'poem3'          // Phase 3: show poems[2]
  | 'tips'           // Phase 4: display tips sequence
  | 'closing'        // Phase 5: resting pulse, closing cue
  | 'complete';      // Done

export interface WindowState {
  /** Window is illuminated */
  lit: boolean;
  
  /** Window ID = reflection ID */
  window_id: string;
  
  /** X position (%) on primary tower */
  x: number;
  
  /** Y position (%) on primary tower */
  y: number;
  
  /** Current opacity */
  opacity: number;
  
  /** Glow intensity */
  glow: number;
}

export interface Stage2State {
  /** Current playback phase */
  phase: Stage2Phase;
  
  /** Post enrichment data */
  payload: PostEnrichmentPayload | null;
  
  /** Window illumination state */
  window: WindowState | null;
  
  /** Current tip index during tips phase */
  currentTipIndex: number;
  
  /** Breath cycles elapsed during Stage 2 */
  stage2CycleCount: number;
  
  /** Started Stage 2 */
  started: boolean;
}

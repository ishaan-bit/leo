/**
 * Zone Mapping - Primary Emotion → Emotional City Tower
 * 
 * Maps Willcox Feelings Wheel primary emotions to their corresponding
 * city zones (towers) with visual identity for the zoom sequence.
 */

// IMPORTANT: Backend now stores CANONICAL Willcox cores (as of Nov 2025 fix)
// Backend canonical primaries: Happy, Strong, Peaceful, Sad, Angry, Fearful (title case)
// Frontend uses display labels: joyful, powerful, peaceful, sad, mad, scared
// getZone() handles mapping automatically

// Frontend display labels
export type PrimaryEmotion = 
  | 'joyful'    // Backend: Happy
  | 'sad'       // Backend: Sad  
  | 'peaceful'  // Backend: Peaceful
  | 'powerful'  // Backend: Strong
  | 'scared'    // Backend: Fearful
  | 'mad';      // Backend: Angry

export interface Zone {
  id: PrimaryEmotion;
  name: string;           // Tower name
  color: string;          // Primary color (hex)
  hue: string;           // Sky tint during zoom
  description: string;   // Poetic description
}

export const ZONE_MAP: Record<PrimaryEmotion, Zone> = {
  joyful: {
    id: 'joyful',
    name: 'Vera',
    color: '#FFD700',           // Golden
    hue: '#FFE5B4',            // Golden-pink sky tint
    description: 'The tower of light and laughter',
  },
  sad: {
    id: 'sad',
    name: 'Vanta',
    color: '#7D8597',           // Steel gray
    hue: '#B0C4DE',            // Pale steel-blue sky tint
    description: 'The tower of quiet sorrow',
  },
  peaceful: {
    id: 'peaceful',
    name: 'Haven',
    color: '#6A9FB5',           // Soft blue
    hue: '#E6E6FA',            // Lavender-white sky tint
    description: 'The tower of stillness',
  },
  powerful: {
    id: 'powerful',
    name: 'Ashmere',
    color: '#FF6B35',           // Orange
    hue: '#008B8B',            // Deep teal/azure sky tint
    description: 'The tower of fierce strength',
  },
  scared: {
    id: 'scared',
    name: 'Vire',
    color: '#5A189A',           // Purple
    hue: '#4B0082',            // Indigo-violet sky tint
    description: 'The tower of trembling shadows',
  },
  mad: {
    id: 'mad',
    name: 'Sable',
    color: '#C1121F',           // Red
    hue: '#8B0000',            // Ember-red sky tint
    description: 'The tower of burning resolve',
  },
};

/**
 * Get zone by primary emotion
 * Handles both canonical Willcox names (Happy, Strong, etc.) and frontend labels (joyful, powerful, etc.)
 */
export function getZone(primary: string | null | undefined): Zone | null {
  if (!primary) return null;
  
  // Normalize input
  const normalized = primary.toLowerCase();
  
  // Map canonical Willcox cores to frontend labels
  const BACKEND_TO_FRONTEND: Record<string, PrimaryEmotion> = {
    // Canonical backend primaries (title case from Willcox wheel)
    'happy': 'joyful',
    'strong': 'powerful',
    'fearful': 'scared',
    'sad': 'sad',
    'angry': 'mad',
    'peaceful': 'peaceful',
    // Also accept frontend labels directly (for backwards compatibility)
    'joyful': 'joyful',
    'powerful': 'powerful',
    'scared': 'scared',
    'mad': 'mad',
  };
  
  const frontendLabel = BACKEND_TO_FRONTEND[normalized];
  if (!frontendLabel) {
    console.warn(`[zones] Unknown primary emotion: "${primary}" (normalized: "${normalized}")`);
    console.warn(`[zones] Available mappings:`, Object.keys(BACKEND_TO_FRONTEND));
    return null;
  }
  
  return ZONE_MAP[frontendLabel] || null;
}

/**
 * Check if string is a valid primary emotion
 */
export function isPrimaryEmotion(value: string): value is PrimaryEmotion {
  return value in ZONE_MAP;
}

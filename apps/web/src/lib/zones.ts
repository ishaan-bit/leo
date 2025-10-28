/**
 * Zone Mapping - Primary Emotion → Emotional City Tower
 * 
 * Maps Willcox Feelings Wheel primary emotions to their corresponding
 * city zones (towers) with visual identity for the zoom sequence.
 */

// IMPORTANT: These MUST match the Willcox Feelings Wheel 6 primaries from the backend
// Backend canonical primaries: sad, angry, fearful, happy, peaceful, strong (lowercase)
// Backend maps to frontend: happy→joyful, angry→mad, fearful→scared, strong→powerful
export type PrimaryEmotion = 
  | 'joyful'    // Backend: happy
  | 'sad'       // Backend: sad
  | 'peaceful'  // Backend: peaceful
  | 'powerful'  // Backend: strong
  | 'scared'    // Backend: fearful
  | 'mad';      // Backend: angry

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
 */
export function getZone(primary: string | null | undefined): Zone | null {
  if (!primary) return null;
  const normalized = primary.toLowerCase() as PrimaryEmotion;
  return ZONE_MAP[normalized] || null;
}

/**
 * Check if string is a valid primary emotion
 */
export function isPrimaryEmotion(value: string): value is PrimaryEmotion {
  return value in ZONE_MAP;
}

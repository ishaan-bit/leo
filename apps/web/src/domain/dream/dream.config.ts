/**
 * Building configurations mapped to primary emotions
 * Ghibli-style City of Living Moments
 */

import type { BuildingConfig, PrimaryEmotion, AudioKey, CopyTemplate } from './dream.types';

/**
 * Six buildings/zones mapped to primaries
 */
export const BUILDINGS: Record<PrimaryEmotion, BuildingConfig> = {
  joyful: {
    name: 'Haven',
    primary: 'joyful',
    colors: {
      base: '#F7D774',
      accent: '#F7B27D',
      glow: '#FFF5E6',
    },
  },
  peaceful: {
    name: 'Vera',
    primary: 'peaceful',
    colors: {
      base: '#A8C3B1',
      accent: '#DDE7E2',
      glow: '#E8F4F0',
    },
  },
  sad: {
    name: 'Lumen',
    primary: 'sad',
    colors: {
      base: '#8AA1B3',
      accent: '#6B7C8E',
      glow: '#F4E6C3', // lamplight accent
    },
  },
  scared: {
    name: 'Aster',
    primary: 'scared',
    colors: {
      base: '#7E6AA6',
      accent: '#5F6C99',
      glow: '#D4C8E8', // star specks
    },
  },
  mad: {
    name: 'Ember',
    primary: 'mad',
    colors: {
      base: '#C88454',
      accent: '#B7A079',
      glow: '#E8D8C8', // cooled smoke
    },
  },
  powerful: {
    name: 'Crown',
    primary: 'powerful',
    colors: {
      base: '#2D6D6D',
      accent: '#C2A869',
      glow: '#9FB6AC', // brass accents
    },
  },
};

/**
 * Audio key mapped to dominant primary
 */
export const AUDIO_KEYS: Record<PrimaryEmotion, AudioKey> = {
  joyful: 'Lydian',
  peaceful: 'Ionian',
  sad: 'Dorian',
  scared: 'Aeolian',
  mad: 'Mixolydian',
  powerful: 'DorianMixo', // hybrid
};

/**
 * Opening lines by absence duration
 */
export function getOpeningLine(daysSinceLastDream: number): string {
  if (daysSinceLastDream >= 30) {
    return "The city had fallen asleep; your return wakes it.";
  } else if (daysSinceLastDream >= 15) {
    return "After many sunsets, the city stirs.";
  } else {
    return "Leo waited by the quiet windows.";
  }
}

/**
 * Copy templates for one-liners per primary
 * {kw} placeholder replaced by extracted keyword
 */
export const COPY_TEMPLATES: CopyTemplate[] = [
  {
    primary: 'joyful',
    variants: [
      "Calm breath returns after {kw}",
      "Gold light lingers over {kw}",
      "Warm morning finds {kw} again",
    ],
  },
  {
    primary: 'peaceful',
    variants: [
      "Quiet tide settles around {kw}",
      "Soft air returns to {kw}",
      "Still roofs breathe with {kw}",
    ],
  },
  {
    primary: 'sad',
    variants: [
      "Rain remembers {kw} with you",
      "Blue hush drifts past {kw}",
      "Lamplight waits beside {kw}",
    ],
  },
  {
    primary: 'scared',
    variants: [
      "Shadows thin; {kw} finds footing",
      "Small stars keep watch over {kw}",
      "Quiet courage walks through {kw}",
    ],
  },
  {
    primary: 'mad',
    variants: [
      "Heat fades; {kw} cools to amber",
      "Breath steadies far from {kw}",
      "Ember light softens around {kw}",
    ],
  },
  {
    primary: 'powerful',
    variants: [
      "{kw} hums; the city listens",
      "Steady steps crown the {kw} hill",
      "Strong winds carry {kw} forward",
    ],
  },
];

/**
 * Stoplist for keyword extraction
 */
export const STOPWORDS = new Set([
  'i', 'me', 'my', 'the', 'a', 'an', 'and', 'or', 'but',
  'today', 'yesterday', 'tomorrow', 'very', 'really', 'just',
  'went', 'got', 'have', 'has', 'had', 'with', 'after', 'before',
  'that', 'this', 'here', 'there', 'into', 'onto', 'from', 'to',
  'for', 'of', 'in', 'on', 'at', 'was', 'were', 'am', 'is', 'are',
  'been', 'be', 'will', 'would', 'could', 'should', 'it', 'its',
]);

/**
 * Extract keywords from normalized text (max 2)
 */
export function extractKeywords(normalizedText: string): string[] {
  // Lowercase and clean
  let cleaned = normalizedText.toLowerCase();
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove hashtags and @ mentions
  cleaned = cleaned.replace(/#\w+/g, '');
  cleaned = cleaned.replace(/@\w+/g, '');
  
  // Remove numbers (2+ digits)
  cleaned = cleaned.replace(/\b\d{2,}\b/g, '');
  
  // Split into tokens
  const tokens = cleaned.match(/\b[a-z]{3,}\b/g) || [];
  
  // Filter stopwords and truncate to 12 chars
  const keywords = tokens
    .filter(t => !STOPWORDS.has(t))
    .map(t => t.slice(0, 12))
    .filter((t, i, arr) => arr.indexOf(t) === i); // unique
  
  // Return first 2, or fallback
  if (keywords.length === 0) {
    return ['this moment'];
  }
  
  return keywords.slice(0, 2);
}

/**
 * Get templated line for a core
 */
export function getTemplatedLine(
  primary: PrimaryEmotion,
  keywords: string[],
  templateIndex: number
): string {
  const template = COPY_TEMPLATES.find(t => t.primary === primary);
  if (!template) {
    return `The city remembers ${keywords[0] || 'this moment'}`;
  }
  
  const variant = template.variants[templateIndex % template.variants.length];
  const kw = keywords[0] || 'this moment';
  
  return variant.replace('{kw}', kw);
}

/**
 * time-theme.ts
 * Time-based theming system for cinematic atmosphere
 */

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'lateNight';

export interface TimeTheme {
  name: TimeOfDay;
  background: string; // Tailwind gradient classes
  particles: {
    colors: string[];
    count: number;
    speed: number;
  };
  ambientLight: string; // Glow color
  greeting: string[];
}

/**
 * Get current time of day
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'dusk';
  if (hour >= 19 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 2) return 'night';
  return 'lateNight'; // 2-5 AM
}

/**
 * Get theme configuration for time of day
 */
export function getTimeTheme(timeOfDay: TimeOfDay): TimeTheme {
  const themes: Record<TimeOfDay, TimeTheme> = {
    dawn: {
      name: 'dawn',
      background: 'from-orange-100 via-pink-100 to-rose-100',
      particles: {
        colors: ['bg-orange-200/30', 'bg-pink-200/40', 'bg-rose-200/30'],
        count: 40,
        speed: 0.8,
      },
      ambientLight: 'rgba(251, 146, 60, 0.15)', // orange-400
      greeting: [
        'A fresh dawn — what first stirred in you?',
        'Morning light breaks. Tell me, what woke with you?',
        'The day begins to whisper. What did you hear first?'
      ],
    },
    morning: {
      name: 'morning',
      background: 'from-amber-50 via-yellow-50 to-pink-100',
      particles: {
        colors: ['bg-amber-200/30', 'bg-yellow-200/30', 'bg-pink-200/30'],
        count: 50,
        speed: 1.0,
      },
      ambientLight: 'rgba(251, 191, 36, 0.12)', // amber-400
      greeting: [
        'Good morning. What has the day already shown you?',
        'The morning hums with possibility — what did it bring?',
        'Sunlight finds its way in. What else arrived with it?'
      ],
    },
    noon: {
      name: 'noon',
      background: 'from-yellow-100 via-pink-100 to-rose-100',
      particles: {
        colors: ['bg-yellow-200/40', 'bg-pink-200/40', 'bg-rose-200/30'],
        count: 60,
        speed: 1.2,
      },
      ambientLight: 'rgba(251, 207, 232, 0.2)', // pink-200
      greeting: [
        'Midday settles. What lingers in you now?',
        'The sun is high — so are thoughts. What\'s yours?',
        'Noon brings clarity or chaos. Which found you?'
      ],
    },
    afternoon: {
      name: 'afternoon',
      background: 'from-orange-100 via-rose-100 to-pink-100',
      particles: {
        colors: ['bg-orange-200/30', 'bg-rose-200/40', 'bg-pink-200/30'],
        count: 55,
        speed: 1.1,
      },
      ambientLight: 'rgba(251, 113, 133, 0.15)', // rose-400
      greeting: [
        'The afternoon stretches. What have you been carrying?',
        'Hours have passed — what stayed with you through them?',
        'The day softens. What still feels sharp inside you?'
      ],
    },
    dusk: {
      name: 'dusk',
      background: 'from-purple-100 via-pink-100 to-rose-100',
      particles: {
        colors: ['bg-purple-200/40', 'bg-pink-200/40', 'bg-rose-200/30'],
        count: 45,
        speed: 0.9,
      },
      ambientLight: 'rgba(192, 132, 252, 0.15)', // purple-400
      greeting: [
        'Dusk arrives, and with it... what else?',
        'The sky shifts. So do you. What changed today?',
        'Light fades, but something remains. What is it?'
      ],
    },
    evening: {
      name: 'evening',
      background: 'from-indigo-100 via-purple-100 to-pink-100',
      particles: {
        colors: ['bg-indigo-200/30', 'bg-purple-200/40', 'bg-pink-200/30'],
        count: 40,
        speed: 0.7,
      },
      ambientLight: 'rgba(165, 180, 252, 0.15)', // indigo-300
      greeting: [
        'Evening settles in — tell me, what lingered in you today?',
        'The day has passed. What did it leave behind?',
        'Night approaches. What are you still holding?'
      ],
    },
    night: {
      name: 'night',
      background: 'from-indigo-200 via-purple-200 to-pink-200',
      particles: {
        colors: ['bg-indigo-300/30', 'bg-purple-300/30', 'bg-pink-300/20'],
        count: 35,
        speed: 0.6,
      },
      ambientLight: 'rgba(129, 140, 248, 0.2)', // indigo-400
      greeting: [
        'The night is quiet. But you — what\'s still awake in you?',
        'Darkness holds space for what daylight couldn\'t. What is it?',
        'Night wraps around everything. What did it uncover?'
      ],
    },
    lateNight: {
      name: 'lateNight',
      background: 'from-slate-200 via-purple-200 to-pink-200',
      particles: {
        colors: ['bg-slate-300/20', 'bg-purple-300/30', 'bg-pink-300/20'],
        count: 30,
        speed: 0.5,
      },
      ambientLight: 'rgba(148, 163, 184, 0.15)', // slate-400
      greeting: [
        'The world sleeps. But you\'re here. What woke you?',
        'This late, thoughts become clear — or loud. Which?',
        'The quietest hour. What is it trying to tell you?'
      ],
    },
  };
  
  return themes[timeOfDay];
}

/**
 * Get random greeting for current time of day
 */
export function getTimeBasedGreeting(pigName: string): string {
  const timeOfDay = getTimeOfDay();
  const theme = getTimeTheme(timeOfDay);
  const greeting = theme.greeting[Math.floor(Math.random() * theme.greeting.length)];
  return greeting;
}

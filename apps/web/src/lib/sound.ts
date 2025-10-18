import { Howl } from "howler";

// Store on window to persist across Next.js page navigations
declare global {
  interface Window {
    __leoAmbientSound?: Howl;
  }
}

const VOLUME_STORAGE_KEY = 'leo.ambient.muted';

export function initAmbientSound() {
  // Check if already initialized on window (persists across page navigations)
  if (typeof window !== 'undefined' && window.__leoAmbientSound) {
    console.log('[sound.ts] Using existing ambient sound instance');
    return window.__leoAmbientSound;
  }
  
  console.log('[sound.ts] Creating NEW ambient sound instance');
  
  // Check if user previously muted
  const wasMuted = typeof window !== 'undefined' 
    ? localStorage.getItem(VOLUME_STORAGE_KEY) === 'true'
    : false;
  
  const ambientSound = new Howl({
    src: ["/audio/ambient.mp3"],
    loop: true,
    volume: wasMuted ? 0 : 0.4, // Start at user's last preference
    html5: true,
    autoplay: true, // Always playing
  });
  
  // Store globally to persist across page navigations
  if (typeof window !== 'undefined') {
    window.__leoAmbientSound = ambientSound;
  }
  
  return ambientSound;
}

export function playAmbientSound() {
  const sound = initAmbientSound();
  sound.fade(sound.volume(), 0.4, 800); // Fade in to audible volume
  
  // Ensure volume is exactly 0.4 after fade completes
  setTimeout(() => {
    const currentSound = typeof window !== 'undefined' ? window.__leoAmbientSound : null;
    if (currentSound) {
      currentSound.volume(0.4);
    }
  }, 850); // Slightly after fade duration (800ms)
  
  localStorage.setItem(VOLUME_STORAGE_KEY, 'false'); // Remember unmuted state
}

export function stopAmbientSound() {
  const sound = typeof window !== 'undefined' ? window.__leoAmbientSound : null;
  if (sound) {
    sound.fade(sound.volume(), 0, 300); // Fade to silent (muted)
    
    // Ensure volume is exactly 0 after fade completes
    setTimeout(() => {
      const currentSound = typeof window !== 'undefined' ? window.__leoAmbientSound : null;
      if (currentSound) {
        currentSound.volume(0);
      }
    }, 350); // Slightly after fade duration (300ms)
    
    localStorage.setItem(VOLUME_STORAGE_KEY, 'true'); // Remember muted state
  }
}

export function isMuted(): boolean {
  return localStorage.getItem(VOLUME_STORAGE_KEY) === 'true';
}

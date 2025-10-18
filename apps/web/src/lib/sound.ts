import { Howl } from "howler";

let ambientSound: Howl | null = null;
const VOLUME_STORAGE_KEY = 'leo.ambient.muted';

export function initAmbientSound() {
  if (ambientSound) return ambientSound;
  
  // Check if user previously muted
  const wasMuted = localStorage.getItem(VOLUME_STORAGE_KEY) === 'true';
  
  ambientSound = new Howl({
    src: ["/audio/ambient.mp3"],
    loop: true,
    volume: wasMuted ? 0 : 0.4, // Start at user's last preference
    html5: true,
    autoplay: true, // Always playing
  });
  
  return ambientSound;
}

export function playAmbientSound() {
  const sound = initAmbientSound();
  sound.fade(sound.volume(), 0.4, 800); // Fade in to audible volume
  localStorage.setItem(VOLUME_STORAGE_KEY, 'false'); // Remember unmuted state
}

export function stopAmbientSound() {
  if (ambientSound) {
    ambientSound.fade(ambientSound.volume(), 0, 300); // Fade to silent (muted)
    localStorage.setItem(VOLUME_STORAGE_KEY, 'true'); // Remember muted state
  }
}

export function isMuted(): boolean {
  return localStorage.getItem(VOLUME_STORAGE_KEY) === 'true';
}

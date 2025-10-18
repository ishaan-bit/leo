import { Howl } from "howler";

let ambientSound: Howl | null = null;

export function initAmbientSound() {
  if (ambientSound) return ambientSound;
  ambientSound = new Howl({
    src: ["/audio/ambient.mp3"],
    loop: true,
    volume: 0.4,
    html5: true,
  });
  return ambientSound;
}

export function playAmbientSound() {
  const sound = initAmbientSound();
  if (!sound.playing()) {
    sound.volume(0); // Start from silence
    sound.play();
    sound.fade(0, 0.4, 800); // Smooth 800ms fade-in
  }
}

export function stopAmbientSound() {
  if (ambientSound && ambientSound.playing()) {
    ambientSound.fade(ambientSound.volume(), 0, 300); // Quick 300ms fade-out
    setTimeout(() => {
      if (ambientSound && !ambientSound.playing()) {
        ambientSound.stop();
      }
    }, 300);
  }
}

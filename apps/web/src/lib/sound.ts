import { Howl } from "howler";

let ambientSound: Howl | null = null;

export function initAmbientSound() {
  if (ambientSound) return ambientSound;
  ambientSound = new Howl({
    src: ["/audio/ambient.mp3"],
    loop: true,
    volume: 0, // Start muted
    html5: true,
    autoplay: true, // Always playing
  });
  return ambientSound;
}

export function playAmbientSound() {
  const sound = initAmbientSound();
  sound.fade(sound.volume(), 0.4, 800); // Fade in to audible volume
}

export function stopAmbientSound() {
  if (ambientSound) {
    ambientSound.fade(ambientSound.volume(), 0, 300); // Fade to silent (muted)
  }
}

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
    sound.fade(0, 0.4, 3000);
    sound.play();
  }
}

export function stopAmbientSound() {
  if (ambientSound && ambientSound.playing()) {
    ambientSound.fade(0.4, 0, 2000);
    setTimeout(() => ambientSound?.stop(), 2000);
  }
}

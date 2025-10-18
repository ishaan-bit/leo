'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AudioEngine } from '@/lib/audio/AudioEngine';

interface AudioContextValue {
  initialized: boolean;
  playing: boolean;
  init: () => Promise<void>;
  play: () => void;
  suspend: () => void;
  resume: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [playing, setPlaying] = useState(false);

  const init = async () => {
    if (!initialized) {
      await AudioEngine.init();
      setInitialized(true);
    }
  };

  const play = () => {
    AudioEngine.playAmbient();
    setPlaying(true);
  };

  const suspend = () => {
    AudioEngine.suspend();
    setPlaying(false);
  };

  const resume = () => {
    AudioEngine.resume();
    setPlaying(true);
  };

  return (
    <AudioContext.Provider value={{ initialized, playing, init, play, suspend, resume }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
}

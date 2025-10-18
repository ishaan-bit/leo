'use client';

import { create } from 'zustand';

export type EntryContext = 'firstTime' | 'returning' | 'guest';

export interface AffectVector {
  valence: number;      // -1..+1 (negative/positive mood)
  arousal: number;      // 0..1 (calm/energized)
  depth: number;        // 0..1 (surface/profound)
  clarity: number;      // 0..1 (confused/clear)
  authenticity: number; // 0..1 (performative/genuine)
  effort: number;       // 0..1 (effortless/strenuous)
  seed?: string;        // interaction signature
}

interface SceneState {
  entry: EntryContext;
  affect: AffectVector | null;
  setAffect: (v: Partial<AffectVector>) => void;
  setEntry: (e: EntryContext) => void;
  reset: () => void;
}

export const useSceneState = create<SceneState>((set) => ({
  entry: 'guest',
  affect: null,
  
  setAffect: (partial) =>
    set((state) => ({
      affect: state.affect ? { ...state.affect, ...partial } : { 
        valence: 0,
        arousal: 0.5,
        depth: 0.5,
        clarity: 0.5,
        authenticity: 0.5,
        effort: 0.5,
        ...partial 
      },
    })),
  
  setEntry: (entry) => set({ entry }),
  
  reset: () => set({ affect: null }),
}));

import { create } from 'zustand';

interface PendingDreamLetter {
  reflectionId: string;
  pigName: string;
  hasDreamLetter: boolean;
}

interface DreamLetterStore {
  pendingDreamLetter: PendingDreamLetter | null;
  setPendingDreamLetter: (letter: PendingDreamLetter | null) => void;
  clearPendingDreamLetter: () => void;
}

export const useDreamLetterStore = create<DreamLetterStore>((set) => ({
  pendingDreamLetter: null,
  setPendingDreamLetter: (letter) => set({ pendingDreamLetter: letter }),
  clearPendingDreamLetter: () => set({ pendingDreamLetter: null }),
}));

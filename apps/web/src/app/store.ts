import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type UiState = {
  selectedCase: string | null;
  reducedMotion: boolean;
  celebrating: boolean;
  selectCase: (id: string | null) => void;
  setMotion: (reduced: boolean) => void;
  celebrate: (value: boolean) => void;
};
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      selectedCase: null,
      reducedMotion: false,
      celebrating: false,
      selectCase: (id) => set({ selectedCase: id }),
      setMotion: (reducedMotion) => set({ reducedMotion }),
      celebrate: (celebrating) => set({ celebrating }),
    }),
    { name: 'tergov-preferences', partialize: (state) => ({ reducedMotion: state.reducedMotion }) },
  ),
);

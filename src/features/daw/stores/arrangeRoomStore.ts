import { create } from "zustand";
import type { Scale } from "@/shared/types";

interface ArrangeRoomScaleState {
  rootNote: string;
  scale: Scale;
  setRootNote: (root: string) => void;
  setScale: (scale: Scale) => void;
}

export const useArrangeRoomScaleStore = create<ArrangeRoomScaleState>((set) => ({
  rootNote: "C",
  scale: "major",
  setRootNote: (rootNote) => set({ rootNote }),
  setScale: (scale) => set({ scale }),
}));

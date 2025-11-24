import { create } from "zustand";
import type { Scale } from "@/shared/types";

interface ArrangeRoomScaleState {
  rootNote: string;
  scale: Scale;
  followProject: boolean;
  setRootNote: (root: string) => void;
  setScale: (scale: Scale) => void;
  setFollowProject: (follow: boolean) => void;
}

export const useArrangeRoomScaleStore = create<ArrangeRoomScaleState>((set) => ({
  rootNote: "C",
  scale: "major",
  followProject: true, // Default to following project scale
  setRootNote: (rootNote) => set({ rootNote }),
  setScale: (scale) => set({ scale }),
  setFollowProject: (followProject) => set({ followProject }),
}));

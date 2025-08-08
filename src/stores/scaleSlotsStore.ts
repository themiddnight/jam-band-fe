import {
  DEFAULT_SCALE_SLOTS,
  type ScaleSlot,
} from "../constants/scaleSlots";
import type { Scale } from "../hooks/useScaleState";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ScaleSlotsState {
  slots: ScaleSlot[];
  selectedSlotId: number | null;
  isInitialized: boolean;

  // Actions
  setSlot: (slotId: number, rootNote: string, scale: Scale) => void;
  selectSlot: (slotId: number) => void;
  getSelectedSlot: () => ScaleSlot | null;
  resetToDefaults: () => void;
  initialize: () => void;
}

export const useScaleSlotsStore = create<ScaleSlotsState>()(
  persist(
    (set, get) => ({
      slots: DEFAULT_SCALE_SLOTS,
      selectedSlotId: null,
      isInitialized: false,

      setSlot: (slotId: number, rootNote: string, scale: Scale) => {
        set((state) => ({
          slots: state.slots.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  rootNote,
                  scale,
                }
              : slot,
          ),
        }));
      },

      selectSlot: (slotId: number) => {
        set({ selectedSlotId: slotId });
      },

      getSelectedSlot: () => {
        const state = get();
        if (state.selectedSlotId === null) return null;
        return (
          state.slots.find((slot) => slot.id === state.selectedSlotId) || null
        );
      },

      resetToDefaults: () => {
        set({
          slots: DEFAULT_SCALE_SLOTS,
          selectedSlotId: null,
          isInitialized: false,
        });
      },

      initialize: () => {
        const state = get();
        if (!state.isInitialized) {
          set({
            selectedSlotId: 1, // Default to first slot
            isInitialized: true,
          });
        }
      },
    }),
    {
      name: "scale-slots-storage",
    },
  ),
);

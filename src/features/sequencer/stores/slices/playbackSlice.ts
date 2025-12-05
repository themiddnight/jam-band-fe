import type { StateCreator } from "zustand";
import type { SequencerStore } from "../../types/store";
import { buildCategoryUpdate } from "../../utils/sequencerUtils";

export interface PlaybackSlice {
  play: () => void;
  stop: () => void;
  pause: () => void;
  softStop: () => void;
  cancelSoftStop: () => void;
  hardStop: () => void;
  togglePlayback: () => void;
  setCurrentBeat: (beat: number) => void;
  nextBeat: () => void;
  resetToStart: () => void;
}

export const createPlaybackSlice: StateCreator<SequencerStore, [], [], PlaybackSlice> = (set, get) => ({
  play: () => {
    set({ isPlaying: true, waitingForMetronome: true });
  },

  stop: () => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        currentBeat: 0,
      });

      return {
        isPlaying: false,
        softStopRequested: false,
        currentBeat: 0,
        waitingForMetronome: false,
        waitingBankChange: null,
        categoryStates: nextCategoryStates,
      };
    });
  },

  pause: () => {
    set({ softStopRequested: true });
  },

  softStop: () => {
    set({ softStopRequested: true });
  },

  cancelSoftStop: () => {
    set({ softStopRequested: false });
  },

  hardStop: () => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        currentBeat: 0,
      });

      return {
        isPlaying: false,
        softStopRequested: false,
        currentBeat: 0,
        waitingForMetronome: false,
        waitingBankChange: null,
        categoryStates: nextCategoryStates,
      };
    });
  },

  togglePlayback: () => {
    const state = get();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  },

  setCurrentBeat: (beat) => {
    set((state) => {
      const maxBeat = state.settings.length - 1;
      const clampedBeat = Math.max(0, Math.min(maxBeat, beat));

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        currentBeat: clampedBeat,
      });

      return {
        currentBeat: clampedBeat,
        categoryStates: nextCategoryStates,
      };
    });
  },

  nextBeat: () => {
    const state = get();
    const nextBeat = (state.currentBeat + 1) % state.settings.length;

    // Handle bank switching in continuous mode
    if (nextBeat === 0 && state.settings.bankMode === "continuous") {
      const nextBank = state.getNextEnabledBank();
      if (nextBank && nextBank !== state.currentBank) {
        set((currentState) => {
          const { nextCategoryStates } = buildCategoryUpdate(currentState, {
            currentBank: nextBank,
          });

          return {
            currentBank: nextBank,
            categoryStates: nextCategoryStates,
          };
        });
      }
    }

    state.setCurrentBeat(nextBeat);
  },

  resetToStart: () => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        currentBeat: 0,
      });

      return {
        currentBeat: 0,
        categoryStates: nextCategoryStates,
      };
    });
  },
});

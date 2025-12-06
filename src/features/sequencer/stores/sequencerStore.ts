import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";

import { InstrumentCategory } from "@/shared/constants/instruments";
import type { SequencerStore } from "../types/store";
import type { SequencerCategoryState, SequencerState } from "../types";
import { createInitialSequencerState, createDefaultCategoryState } from "../utils/sequencerUtils";

// Slices
import { createStepSlice } from "./slices/stepSlice";
import { createBankSlice } from "./slices/bankSlice";
import { createPlaybackSlice } from "./slices/playbackSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createPresetSlice } from "./slices/presetSlice";
import { createUtilitySlice } from "./slices/utilitySlice";

const createMemoryStorage = (): StateStorage => {
  const storage = new Map<string, string>();
  return {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => {
      storage.set(name, value);
    },
    removeItem: (name) => {
      storage.delete(name);
    },
  };
};

const resolvePersistenceStorage = (): StateStorage => {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  return createMemoryStorage();
};

const persistenceStorage = resolvePersistenceStorage();

// Initial state
const initialState: SequencerState = createInitialSequencerState();

export const useSequencerStore = create<SequencerStore>()(
  subscribeWithSelector(
    persist(
      (set, get, api) => ({
        ...initialState,
        ...createStepSlice(set, get, api),
        ...createBankSlice(set, get, api),
        ...createPlaybackSlice(set, get, api),
        ...createSettingsSlice(set, get, api),
        ...createPresetSlice(set, get, api),
        ...createUtilitySlice(set, get, api),
      }),
      {
        name: "sequencer-store",
        storage: createJSONStorage(() => persistenceStorage),
        version: 1,
        partialize: (state) => ({
          banks: state.banks,
          settings: state.settings,
          presets: state.presets,
          clipboard: state.clipboard,
          selectedBeat: state.selectedBeat,
          categoryStates: state.categoryStates,
          activeCategory: state.activeCategory,
          isCollapsed: state.isCollapsed,
        }),
        migrate: (persistedState: any) => {
          if (!persistedState || persistedState.categoryStates) {
            return persistedState;
          }

          const defaultCategoryState = createDefaultCategoryState();

          const legacyBanks = persistedState.banks ?? defaultCategoryState.banks;
          const legacySettings = persistedState.settings ?? defaultCategoryState.settings;
          const legacySelectedBeat = persistedState.selectedBeat ?? defaultCategoryState.selectedBeat;
          const legacyPresets = persistedState.presets ?? [];
          const legacyClipboard = persistedState.clipboard ?? null;

          const drumCategoryState: SequencerCategoryState = {
            banks: legacyBanks,
            settings: legacySettings,
            currentBank: defaultCategoryState.currentBank,
            currentBeat: defaultCategoryState.currentBeat,
            selectedBeat: legacySelectedBeat,
            presets: legacyPresets,
            clipboard: legacyClipboard,
          };

          return {
            ...persistedState,
            activeCategory: InstrumentCategory.DrumBeat,
            categoryStates: {
              [InstrumentCategory.DrumBeat]: drumCategoryState,
              [InstrumentCategory.Melodic]: createDefaultCategoryState(InstrumentCategory.Melodic),
              [InstrumentCategory.Synthesizer]: createDefaultCategoryState(InstrumentCategory.Synthesizer),
            },
          };
        },
      }
    )
  )
);

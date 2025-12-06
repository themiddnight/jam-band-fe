import { InstrumentCategory } from "../../../shared/constants/instruments";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useUserStore } from "@/shared/stores/userStore";
import * as userPresetsAPI from "@/shared/api/userPresets";
import { debounce } from "lodash";

interface InstrumentPreferences {
  instrument: string;
  category: InstrumentCategory;
  synthParams?: any;
}

interface InstrumentPreferencesState {
  preferences: Record<string, InstrumentPreferences>;
  setPreferences: (
    instrumentId: string,
    instrument: string,
    category: InstrumentCategory,
    synthParams?: any,
  ) => void;
  getPreferences: (instrumentId: string) => InstrumentPreferences;
  clearPreferences: (instrumentId?: string) => void;
}

const defaultPreferences: InstrumentPreferences = {
  instrument: "acoustic_grand_piano",
  category: InstrumentCategory.Melodic,
};

// Debounced save to API (only for authenticated users)
const debouncedSavePreferences = debounce(async (preferences: Record<string, InstrumentPreferences>) => {
  const { isAuthenticated, userType } = useUserStore.getState();
  const isGuest = userType === "GUEST" || !isAuthenticated;
  
  // Guest users cannot save settings
  if (isGuest) {
    return;
  }
  
  try {
    await userPresetsAPI.updateSettings({
      settingsType: "instrument_preferences",
      data: preferences,
    });
  } catch (error) {
    console.error("Error saving instrument preferences to API:", error);
  }
}, 1000);

export const useInstrumentPreferencesStore =
  create<InstrumentPreferencesState>()(
    persist(
      (set, get) => ({
        preferences: {},

        setPreferences: (
          instrumentId: string,
          instrument: string,
          category: InstrumentCategory,
          synthParams?: any,
        ) => {
          set((state) => {
            const newPreferences = {
              ...state.preferences,
              [instrumentId]: { instrument, category, synthParams },
            };
            // Save to API (debounced)
            debouncedSavePreferences(newPreferences);
            return { preferences: newPreferences };
          });
        },

        getPreferences: (instrumentId: string) => {
          const { preferences } = get();
          return preferences[instrumentId] || defaultPreferences;
        },

        clearPreferences: (instrumentId?: string) => {
          if (instrumentId) {
            set((state) => {
              const newPreferences = { ...state.preferences };
              delete newPreferences[instrumentId];
              return { preferences: newPreferences };
            });
          } else {
            set({ preferences: {} });
          }
        },
      }),
      {
        name: "instrument-preferences",
        storage: createJSONStorage(() => localStorage),
      },
    ),
  );

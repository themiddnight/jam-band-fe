import { InstrumentCategory } from "../../../shared/constants/instruments";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface InstrumentPreferences {
  instrument: string;
  category: InstrumentCategory;
}

interface InstrumentPreferencesState {
  preferences: Record<string, InstrumentPreferences>;
  setPreferences: (
    instrumentId: string,
    instrument: string,
    category: InstrumentCategory,
  ) => void;
  getPreferences: (instrumentId: string) => InstrumentPreferences;
  clearPreferences: (instrumentId?: string) => void;
}

const defaultPreferences: InstrumentPreferences = {
  instrument: "acoustic_grand_piano",
  category: InstrumentCategory.Melodic,
};

export const useInstrumentPreferencesStore =
  create<InstrumentPreferencesState>()(
    persist(
      (set, get) => ({
        preferences: {},

        setPreferences: (
          instrumentId: string,
          instrument: string,
          category: InstrumentCategory,
        ) => {
          set((state) => ({
            preferences: {
              ...state.preferences,
              [instrumentId]: { instrument, category },
            },
          }));
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

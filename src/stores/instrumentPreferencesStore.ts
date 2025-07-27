import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { InstrumentCategory } from '../constants/instruments';

interface InstrumentPreferences {
  instrument: string;
  category: InstrumentCategory;
}

interface InstrumentPreferencesState {
  preferences: InstrumentPreferences;
  setPreferences: (instrument: string, category: InstrumentCategory) => void;
  clearPreferences: () => void;
}

const defaultPreferences: InstrumentPreferences = {
  instrument: 'acoustic_grand_piano',
  category: InstrumentCategory.Melodic,
};

export const useInstrumentPreferencesStore = create<InstrumentPreferencesState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      
      setPreferences: (instrument: string, category: InstrumentCategory) => {
        set({
          preferences: { instrument, category }
        });
      },
      
      clearPreferences: () => {
        set({ preferences: defaultPreferences });
      },
    }),
    {
      name: 'instrument-preferences',
      storage: createJSONStorage(() => localStorage),
    }
  )
); 
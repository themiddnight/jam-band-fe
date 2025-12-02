import type { SynthPreset, PresetManager, PresetBank } from "../types/presets";
import type { SynthState } from "../utils/InstrumentEngine";
import { useReducer, useEffect, useCallback } from "react";
import { useUserStore } from "@/shared/stores/userStore";
import * as userPresetsAPI from "@/shared/api/userPresets";
import type { UserPreset } from "@/shared/api/userPresets";

const STORAGE_KEY = "jam-band-synth-presets";
const PRESET_VERSION = "1.0.0";

// State interface for the reducer
interface PresetManagerState {
  currentPreset: SynthPreset | null;
  presets: SynthPreset[];
  isLoading: boolean;
  error: string | null;
}

// Action types
type PresetManagerAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_PRESETS"; payload: SynthPreset[] }
  | { type: "SET_CURRENT_PRESET"; payload: SynthPreset | null }
  | { type: "ADD_PRESET"; payload: SynthPreset }
  | { type: "UPDATE_PRESET"; payload: SynthPreset }
  | { type: "DELETE_PRESET"; payload: string }
  | { type: "RESET" };

// Initial state
const initialState: PresetManagerState = {
  currentPreset: null,
  presets: [],
  isLoading: false,
  error: null,
};

// Reducer function
const presetManagerReducer = (
  state: PresetManagerState,
  action: PresetManagerAction,
): PresetManagerState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_PRESETS":
      return { ...state, presets: action.payload, error: null };

    case "SET_CURRENT_PRESET":
      return { ...state, currentPreset: action.payload };

    case "ADD_PRESET":
      return {
        ...state,
        presets: [...state.presets, action.payload],
        currentPreset: action.payload,
        error: null,
      };

    case "UPDATE_PRESET":
      return {
        ...state,
        presets: state.presets.map((preset) =>
          preset.id === action.payload.id ? action.payload : preset,
        ),
        currentPreset:
          state.currentPreset?.id === action.payload.id
            ? action.payload
            : state.currentPreset,
        error: null,
      };

    case "DELETE_PRESET":
      return {
        ...state,
        presets: state.presets.filter((preset) => preset.id !== action.payload),
        currentPreset:
          state.currentPreset?.id === action.payload
            ? null
            : state.currentPreset,
        error: null,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
};

// Helper to convert UserPreset to SynthPreset
const userPresetToSynthPreset = (userPreset: UserPreset): SynthPreset => {
  const data = userPreset.data as {
    synthType: "analog" | "fm";
    polyphony: "mono" | "poly";
    parameters: SynthState;
  };
  return {
    id: userPreset.id,
    name: userPreset.name,
    synthType: data.synthType,
    polyphony: data.polyphony,
    parameters: data.parameters,
    createdAt: new Date(userPreset.createdAt),
    updatedAt: new Date(userPreset.updatedAt),
  };
};

// Helper to convert SynthPreset to API format
const synthPresetToAPIData = (preset: SynthPreset) => ({
  synthType: preset.synthType,
  polyphony: preset.polyphony,
  parameters: preset.parameters,
});

export const usePresetManager = (): PresetManager => {
  const [state, dispatch] = useReducer(presetManagerReducer, initialState);
  const { isAuthenticated, userType } = useUserStore();
  const isGuest = userType === "GUEST" || !isAuthenticated;

  // Load from localStorage (for guests or fallback)
  const loadPresetsFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const presetBank: PresetBank = JSON.parse(stored);
        const parsedPresets = presetBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));
        dispatch({ type: "SET_PRESETS", payload: parsedPresets });
      }
    } catch (err) {
      console.error("Error loading presets from storage:", err);
    }
  }, []);

  // Load from API (for authenticated users)
  const loadPresetsFromAPI = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await userPresetsAPI.getPresets("SYNTH");
      const synthPresets = response.presets.map(userPresetToSynthPreset);
      dispatch({ type: "SET_PRESETS", payload: synthPresets });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (err) {
      console.error("Error loading presets from API:", err);
      // Fallback to localStorage if API fails
      loadPresetsFromStorage();
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to load presets from server",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [loadPresetsFromStorage]);

  // Load presets on initialization
  useEffect(() => {
    if (isGuest) {
      loadPresetsFromStorage();
    } else {
      loadPresetsFromAPI();
    }
  }, [isGuest, loadPresetsFromStorage, loadPresetsFromAPI]);

  // Save to localStorage (for guests)
  const savePresetsToStorage = useCallback((presetsToSave: SynthPreset[]) => {
    try {
      const presetBank: PresetBank = {
        presets: presetsToSave,
        version: PRESET_VERSION,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presetBank));
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to save presets to storage",
      });
      console.error("Error saving presets:", err);
    }
  }, []);

  const savePreset = useCallback(
    async (
      name: string,
      synthType: "analog" | "fm",
      polyphony: "mono" | "poly",
      parameters: SynthState,
    ): Promise<void> => {
      try {
        const now = new Date();
        const newPreset: SynthPreset = {
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          synthType,
          polyphony,
          parameters: { ...parameters },
          createdAt: now,
          updatedAt: now,
        };

        if (isGuest) {
          // Guest: save to localStorage only
          const updatedPresets = [...state.presets, newPreset];
          dispatch({ type: "ADD_PRESET", payload: newPreset });
          savePresetsToStorage(updatedPresets);
        } else {
          // Authenticated: save to API
          try {
            const response = await userPresetsAPI.savePreset({
              presetType: "SYNTH",
              name,
              data: synthPresetToAPIData(newPreset),
            });
            // Update with server ID
            const serverPreset = userPresetToSynthPreset(response.preset);
            dispatch({ type: "ADD_PRESET", payload: serverPreset });
          } catch (apiErr) {
            // Fallback to localStorage if API fails
            const updatedPresets = [...state.presets, newPreset];
            dispatch({ type: "ADD_PRESET", payload: newPreset });
            savePresetsToStorage(updatedPresets);
            throw apiErr;
          }
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to save preset" });
        console.error("Error saving preset:", err);
        throw err;
      }
    },
    [state.presets, savePresetsToStorage, isGuest],
  );

  const loadPreset = useCallback((preset: SynthPreset) => {
    dispatch({ type: "SET_CURRENT_PRESET", payload: preset });
  }, []);

  const deletePreset = useCallback(
    async (presetId: string): Promise<void> => {
      try {
        if (!isGuest) {
          // Authenticated: delete from API
          try {
            await userPresetsAPI.deletePreset(presetId);
          } catch (apiErr) {
            console.error("Error deleting preset from API:", apiErr);
            // Continue with local delete even if API fails
          }
        }
        
        // Update local state
        const updatedPresets = state.presets.filter(
          (preset) => preset.id !== presetId,
        );
        dispatch({ type: "DELETE_PRESET", payload: presetId });
        
        // Save to localStorage (for guests or as backup)
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete preset" });
        console.error("Error deleting preset:", err);
        throw err;
      }
    },
    [state.presets, savePresetsToStorage, isGuest],
  );

  const exportPresets = useCallback((): string => {
    try {
      const presetBank: PresetBank = {
        presets: state.presets,
        version: PRESET_VERSION,
      };
      return JSON.stringify(presetBank, null, 2);
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: "Failed to export presets" });
      console.error("Error exporting presets:", err);
      throw err;
    }
  }, [state.presets]);

  const importPresets = useCallback(
    async (jsonData: string, mode: "replace" | "merge" = "merge"): Promise<void> => {
      try {
        const importedBank: PresetBank = JSON.parse(jsonData);

        // Convert date strings back to Date objects
        const importedPresets = importedBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));

        if (isGuest) {
          // Guest: save to localStorage only
          const updatedPresets =
            mode === "replace"
              ? importedPresets
              : [...state.presets, ...importedPresets];
          dispatch({ type: "SET_PRESETS", payload: updatedPresets });
          savePresetsToStorage(updatedPresets);
        } else {
          // Authenticated: save to API
          const updatedPresets =
            mode === "replace"
              ? importedPresets
              : [...state.presets, ...importedPresets];
          
          // Save each preset to API
          for (const preset of importedPresets) {
            try {
              await userPresetsAPI.savePreset({
                presetType: "SYNTH",
                name: preset.name,
                data: synthPresetToAPIData(preset),
              });
            } catch (apiErr) {
              console.error("Error saving imported preset to API:", apiErr);
            }
          }
          
          dispatch({ type: "SET_PRESETS", payload: updatedPresets });
          // Also save to localStorage as backup
          savePresetsToStorage(updatedPresets);
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to import presets" });
        console.error("Error importing presets:", err);
        throw err;
      }
    },
    [state.presets, savePresetsToStorage, isGuest],
  );

  const getPresetsForSynth = useCallback(
    (synthType: "analog" | "fm", polyphony: "mono" | "poly"): SynthPreset[] => {
      return state.presets.filter(
        (preset) =>
          preset.synthType === synthType && preset.polyphony === polyphony,
      );
    },
    [state.presets],
  );

  return {
    currentPreset: state.currentPreset,
    presets: state.presets,
    isLoading: state.isLoading,
    error: state.error,
    savePreset,
    loadPreset,
    deletePreset,
    exportPresets,
    importPresets,
    getPresetsForSynth,
  };
};

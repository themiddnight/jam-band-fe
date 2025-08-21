import type { SynthPreset, PresetManager, PresetBank } from "../types/presets";
import type { SynthState } from "../utils/InstrumentEngine";
import { useReducer, useEffect, useCallback } from "react";

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

export const usePresetManager = (): PresetManager => {
  const [state, dispatch] = useReducer(presetManagerReducer, initialState);

  const loadPresetsFromStorage = useCallback(() => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const presetBank: PresetBank = JSON.parse(stored);
        // Convert date strings back to Date objects
        const parsedPresets = presetBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));
        dispatch({ type: "SET_PRESETS", payload: parsedPresets });
      }
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to load presets from storage",
      });
      console.error("Error loading presets:", err);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Load presets from localStorage on initialization
  useEffect(() => {
    loadPresetsFromStorage();
  }, [loadPresetsFromStorage]);

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
    (
      name: string,
      synthType: "analog" | "fm",
      polyphony: "mono" | "poly",
      parameters: SynthState,
    ): void => {
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

        const updatedPresets = [...state.presets, newPreset];
        dispatch({ type: "ADD_PRESET", payload: newPreset });
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to save preset" });
        console.error("Error saving preset:", err);
        throw err;
      }
    },
    [state.presets, savePresetsToStorage],
  );

  const loadPreset = useCallback((preset: SynthPreset) => {
    dispatch({ type: "SET_CURRENT_PRESET", payload: preset });
  }, []);

  const deletePreset = useCallback(
    (presetId: string): void => {
      try {
        const updatedPresets = state.presets.filter(
          (preset) => preset.id !== presetId,
        );
        dispatch({ type: "DELETE_PRESET", payload: presetId });
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete preset" });
        console.error("Error deleting preset:", err);
      }
    },
    [state.presets, savePresetsToStorage],
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
    (jsonData: string, mode: "replace" | "merge" = "merge"): void => {
      try {
        const importedBank: PresetBank = JSON.parse(jsonData);

        // Convert date strings back to Date objects
        const importedPresets = importedBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));

        const updatedPresets =
          mode === "replace"
            ? importedPresets
            : [...state.presets, ...importedPresets];

        dispatch({ type: "SET_PRESETS", payload: updatedPresets });
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to import presets" });
        console.error("Error importing presets:", err);
      }
    },
    [state.presets, savePresetsToStorage],
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

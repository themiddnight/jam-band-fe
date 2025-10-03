import { useReducer, useEffect, useCallback, useRef } from 'react';
import type {
  BasePreset,
  PresetBank,
  PresetManagerConfig,
  PresetImportResult,
  ImportOptions,
} from './types';

// State interface for the reducer
interface PresetManagerState<T extends BasePreset> {
  currentPreset: T | null;
  presets: T[];
  isLoading: boolean;
  error: string | null;
}

// Action types
type PresetManagerAction<T extends BasePreset> =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PRESETS'; payload: T[] }
  | { type: 'SET_CURRENT_PRESET'; payload: T | null }
  | { type: 'ADD_PRESET'; payload: T }
  | { type: 'UPDATE_PRESET'; payload: T }
  | { type: 'DELETE_PRESET'; payload: string }
  | { type: 'RESET' };

// Reducer function
function createPresetReducer<T extends BasePreset>() {
  return (
    state: PresetManagerState<T>,
    action: PresetManagerAction<T>
  ): PresetManagerState<T> => {
    switch (action.type) {
      case 'SET_LOADING':
        return { ...state, isLoading: action.payload };

      case 'SET_ERROR':
        return { ...state, error: action.payload };

      case 'SET_PRESETS':
        return { ...state, presets: action.payload, error: null };

      case 'SET_CURRENT_PRESET':
        return { ...state, currentPreset: action.payload };

      case 'ADD_PRESET':
        return {
          ...state,
          presets: [...state.presets, action.payload],
          currentPreset: action.payload,
          error: null,
        };

      case 'UPDATE_PRESET':
        return {
          ...state,
          presets: state.presets.map((preset) =>
            preset.id === action.payload.id ? action.payload : preset
          ),
          currentPreset:
            state.currentPreset?.id === action.payload.id
              ? action.payload
              : state.currentPreset,
          error: null,
        };

      case 'DELETE_PRESET':
        return {
          ...state,
          presets: state.presets.filter((preset) => preset.id !== action.payload),
          currentPreset:
            state.currentPreset?.id === action.payload
              ? null
              : state.currentPreset,
          error: null,
        };

      case 'RESET':
        return {
          currentPreset: null,
          presets: [],
          isLoading: false,
          error: null,
        };

      default:
        return state;
    }
  };
}

export interface UsePresetManagerReturn<T extends BasePreset> {
  // State
  currentPreset: T | null;
  presets: T[];
  isLoading: boolean;
  error: string | null;

  // Actions
  savePreset: (preset: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => void;
  loadPreset: (preset: T) => void;
  deletePreset: (presetId: string) => void;
  exportPresets: () => string;
  importPresetsFromFile: (
    file: File,
    options: ImportOptions
  ) => Promise<PresetImportResult<T>>;
  importPresetsFromData: (
    data: string,
    options: ImportOptions
  ) => PresetImportResult<T>;
  clearError: () => void;
}

export function usePresetManager<T extends BasePreset>(
  config: PresetManagerConfig<T>
): UsePresetManagerReturn<T> {
  const { storageKey, version, validator, onImportSuccess, onImportError } = config;

  const initialState: PresetManagerState<T> = {
    currentPreset: null,
    presets: [],
    isLoading: false,
    error: null,
  };

  const reducer = useRef(createPresetReducer<T>()).current;
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load presets from localStorage on initialization
  const loadPresetsFromStorage = useCallback(() => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const presetBank: PresetBank<T> = JSON.parse(stored);
        // Convert date strings back to Date objects
        const parsedPresets = presetBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));
        dispatch({ type: 'SET_PRESETS', payload: parsedPresets });
      }
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to load presets from storage',
      });
      console.error('Error loading presets:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [storageKey]);

  useEffect(() => {
    loadPresetsFromStorage();
  }, [loadPresetsFromStorage]);

  // Save presets to localStorage
  const savePresetsToStorage = useCallback(
    (presetsToSave: T[]) => {
      try {
        const presetBank: PresetBank<T> = {
          presets: presetsToSave,
          version,
        };
        localStorage.setItem(storageKey, JSON.stringify(presetBank));
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'Failed to save presets to storage',
        });
        console.error('Error saving presets:', err);
      }
    },
    [storageKey, version]
  );

  // Save a new preset
  const savePreset = useCallback(
    (preset: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): void => {
      try {
        const now = new Date();
        const newPreset = {
          ...preset,
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        } as T;

        const updatedPresets = [...state.presets, newPreset];
        dispatch({ type: 'ADD_PRESET', payload: newPreset });
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to save preset' });
        console.error('Error saving preset:', err);
        throw err;
      }
    },
    [state.presets, savePresetsToStorage]
  );

  // Load a preset
  const loadPreset = useCallback((preset: T) => {
    dispatch({ type: 'SET_CURRENT_PRESET', payload: preset });
  }, []);

  // Delete a preset
  const deletePreset = useCallback(
    (presetId: string): void => {
      try {
        const updatedPresets = state.presets.filter(
          (preset) => preset.id !== presetId
        );
        dispatch({ type: 'DELETE_PRESET', payload: presetId });
        savePresetsToStorage(updatedPresets);
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to delete preset' });
        console.error('Error deleting preset:', err);
      }
    },
    [state.presets, savePresetsToStorage]
  );

  // Export presets as JSON string
  const exportPresets = useCallback((): string => {
    try {
      const presetBank: PresetBank<T> = {
        presets: state.presets,
        version,
      };
      return JSON.stringify(presetBank, null, 2);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to export presets' });
      console.error('Error exporting presets:', err);
      throw err;
    }
  }, [state.presets, version]);

  // Validate and filter presets
  const validatePresets = useCallback(
    (presets: T[], options: ImportOptions): PresetImportResult<T> => {
      if (!validator) {
        // No validator, all presets are compatible
        return {
          success: true,
          importedPresets: presets,
          incompatiblePresets: [],
        };
      }

      const compatible: T[] = [];
      const incompatible: T[] = [];

      presets.forEach((preset) => {
        const result = validator.validate(preset, options.context || {});
        if (result.valid) {
          compatible.push(preset);
        } else {
          incompatible.push(preset);
        }
      });

      // Build result
      if (compatible.length === 0) {
        // All incompatible
        const firstIncompatible = incompatible[0];
        const validationResult = validator.validate(
          firstIncompatible,
          options.context || {}
        );
        return {
          success: false,
          importedPresets: [],
          incompatiblePresets: incompatible,
          errorMessage: validationResult.message || 'All presets are incompatible',
        };
      } else if (incompatible.length > 0) {
        // Some incompatible
        return {
          success: true,
          importedPresets: compatible,
          incompatiblePresets: incompatible,
          errorMessage: `${incompatible.length} out of ${presets.length} presets are incompatible and will not be imported.`,
        };
      }

      // All compatible
      return {
        success: true,
        importedPresets: compatible,
        incompatiblePresets: [],
      };
    },
    [validator]
  );

  // Import presets from data string
  const importPresetsFromData = useCallback(
    (data: string, options: ImportOptions): PresetImportResult<T> => {
      try {
        const importedBank: PresetBank<T> = JSON.parse(data);

        // Convert date strings back to Date objects
        const importedPresets = importedBank.presets.map((preset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt),
        }));

        // Validate presets
        const validationResult = validatePresets(importedPresets, options);

        if (!validationResult.success) {
          onImportError?.(validationResult.errorMessage || 'Import failed');
          return validationResult;
        }

        // Apply import based on mode
        const updatedPresets =
          options.mode === 'replace'
            ? validationResult.importedPresets
            : [...state.presets, ...validationResult.importedPresets];

        dispatch({ type: 'SET_PRESETS', payload: updatedPresets });
        savePresetsToStorage(updatedPresets);

        if (validationResult.errorMessage) {
          // Some were incompatible
          onImportError?.(validationResult.errorMessage);
        } else {
          onImportSuccess?.(validationResult.importedPresets);
        }

        return validationResult;
      } catch (err) {
        const errorMessage = 'Failed to import presets. Please ensure the file is a valid preset JSON file.';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        onImportError?.(errorMessage);
        console.error('Error importing presets:', err);
        return {
          success: false,
          importedPresets: [],
          incompatiblePresets: [],
          errorMessage,
        };
      }
    },
    [state.presets, validatePresets, savePresetsToStorage, onImportSuccess, onImportError]
  );

  // Import presets from file
  const importPresetsFromFile = useCallback(
    (file: File, options: ImportOptions): Promise<PresetImportResult<T>> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const result = importPresetsFromData(content, options);
          resolve(result);
        };
        reader.onerror = () => {
          const errorMessage = 'Failed to read file';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
          onImportError?.(errorMessage);
          resolve({
            success: false,
            importedPresets: [],
            incompatiblePresets: [],
            errorMessage,
          });
        };
        reader.readAsText(file);
      });
    },
    [importPresetsFromData, onImportError]
  );

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  return {
    currentPreset: state.currentPreset,
    presets: state.presets,
    isLoading: state.isLoading,
    error: state.error,
    savePreset,
    loadPreset,
    deletePreset,
    exportPresets,
    importPresetsFromFile,
    importPresetsFromData,
    clearError,
  };
}

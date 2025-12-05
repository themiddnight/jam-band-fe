import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { DEFAULT_MELODIC_PRESETS } from "../constants/defaultPresets";
import { useUserStore } from "@/shared/stores/userStore";
import * as presetSync from "../utils/presetSync";
import type {
  SequencerState,
  SequencerStep,
  SequencerBank,
  SequencerSettings,
  SequencerPreset,
  BankName,
  DisplayMode,
  BankMode,
  EditMode,
  SequencerCategoryState,
} from "../types";

// Shallow comparison utilities for performance optimization
const shallowEqual = (obj1: any, obj2: any): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
};

const arraysShallowEqual = <T>(arr1: T[], arr2: T[]): boolean => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
};

// Step comparison utility for checking if step arrays actually changed
const stepsEqual = (steps1: SequencerStep[], steps2: SequencerStep[]): boolean => {
  if (steps1.length !== steps2.length) return false;

  return steps1.every((step1, index) => {
    const step2 = steps2[index];
    return step1.id === step2.id &&
      step1.beat === step2.beat &&
      step1.note === step2.note &&
      step1.velocity === step2.velocity &&
      step1.gate === step2.gate &&
      step1.enabled === step2.enabled;
  });
};

interface SequencerStore extends SequencerState {
  // Step management
  addStep: (bankId: string, beat: number, note: string, velocity?: number, gate?: number) => void;
  removeStep: (bankId: string, stepId: string) => void;
  updateStep: (bankId: string, beat: number, note: string, updates: Partial<SequencerStep>) => void;
  toggleStep: (bankId: string, beat: number, note: string) => void;
  clearBeat: (bankId: string, beat: number) => void;
  clearBank: (bankId: string) => void;
  clearAllBanks: () => void;

  // Bank management
  switchBank: (bankId: string) => void;
  toggleBankEnabled: (bankId: string) => void;
  duplicateBank: (fromBankId: string, toBankId: string) => void;

  // Copy/Paste functionality
  copyBank: (bankId: string) => void;
  pasteBank: (bankId: string) => void;
  clearClipboard: () => void;

  // Playback control
  play: () => void;
  stop: () => void;
  pause: () => void;
  softStop: () => void; // New: request soft-stop (wait for sequence end)
  cancelSoftStop: () => void; // New: cancel pending soft-stop request
  hardStop: () => void; // New: immediate stop with note-off
  togglePlayback: () => void;
  setCurrentBeat: (beat: number) => void;
  nextBeat: () => void;
  resetToStart: () => void;

  // Recording
  toggleRecording: () => void;
  recordStep: (note: string, velocity?: number, gate?: number, isRealtime?: boolean) => void;

  // Settings
  updateSettings: (settings: Partial<SequencerSettings>) => void;
  setSpeed: (speed: number) => void;
  setLength: (length: number) => void;
  setBankMode: (mode: BankMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setEditMode: (mode: EditMode) => void;

  // UI state
  setSelectedBeat: (beat: number) => void;
  setWaitingForMetronome: (waiting: boolean) => void;
  setWaitingBankChange: (bankId: string | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;

  // Preset management
  savePreset: (name: string, instrumentCategory: string) => Promise<void>;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => Promise<void>;
  exportPreset: (presetId: string) => string;
  importPreset: (presetData: string) => Promise<void>;
  // API sync methods
  loadPresetsFromAPI: () => Promise<void>;
  syncPresetsToAPI: () => Promise<void>;

  // Utility functions
  getStepsForBeat: (bankId: string, beat: number) => SequencerStep[];
  getActiveStepsForBeat: (beat: number) => SequencerStep[];
  hasStepAtBeat: (bankId: string, beat: number, note: string) => boolean;
  getNextEnabledBank: () => string | null;
  getBeatStepsCount: (bankId: string, beat: number) => number;
  getTotalStepsCount: (bankId: string) => number;

  // Reset
  reset: () => void;
  resetUI: () => void;

  // Category management
  setActiveCategory: (category: string) => void;
}

// Helper function to create empty bank
const createEmptyBank = (id: string, name: string): SequencerBank => ({
  id,
  name,
  steps: [],
  enabled: true,
});

// Helper function to create default banks
const createDefaultBanks = (): Record<string, SequencerBank> => {
  const banks: Record<string, SequencerBank> = {};
  SEQUENCER_CONSTANTS.BANK_NAMES.forEach((name) => {
    banks[name] = createEmptyBank(name, name);
  });
  return banks;
};

const createDefaultCategoryState = (category?: string): SequencerCategoryState => {
  // Load default presets for melodic category
  const defaultPresets = category === InstrumentCategory.Melodic ? DEFAULT_MELODIC_PRESETS : [];

  return {
    banks: createDefaultBanks(),
    settings: {
      speed: SEQUENCER_CONSTANTS.DEFAULT_SPEED,
      length: SEQUENCER_CONSTANTS.DEFAULT_LENGTH,
      bankMode: "single",
      displayMode: "scale_notes",
      editMode: "note",
    },
    currentBank: "A",
    currentBeat: 0,
    selectedBeat: 0,
    presets: defaultPresets,
    clipboard: null,
  };
};

const DEFAULT_CATEGORY = InstrumentCategory.Melodic;

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

const ensureCategoryState = (
  state: SequencerState,
  category: string
): { categoryState: SequencerCategoryState; categoryStates: Record<string, SequencerCategoryState> } => {
  const existing = state.categoryStates[category];
  if (existing) {
    return { categoryState: existing, categoryStates: state.categoryStates };
  }

  const newCategoryState = createDefaultCategoryState(category);
  return {
    categoryState: newCategoryState,
    categoryStates: {
      ...state.categoryStates,
      [category]: newCategoryState,
    },
  };
};

const buildCategoryUpdate = (
  state: SequencerState,
  updates: Partial<SequencerCategoryState>
): {
  nextCategoryStates: Record<string, SequencerCategoryState>;
  updatedCategoryState: SequencerCategoryState;
  activeCategory: string;
} => {
  const activeCategory = state.activeCategory || DEFAULT_CATEGORY;
  const { categoryState, categoryStates } = ensureCategoryState(state, activeCategory);
  const updatedCategoryState: SequencerCategoryState = {
    ...categoryState,
    ...updates,
  };

  const baseCategoryStates =
    categoryStates === state.categoryStates
      ? { ...state.categoryStates }
      : { ...categoryStates };

  baseCategoryStates[activeCategory] = updatedCategoryState;

  return {
    nextCategoryStates: baseCategoryStates,
    updatedCategoryState,
    activeCategory,
  };
};

const createInitialSequencerState = (): SequencerState => {
  const defaultCategoryState = createDefaultCategoryState(DEFAULT_CATEGORY);

  return {
    isPlaying: false,
    isRecording: false,
    softStopRequested: false,
    currentBeat: defaultCategoryState.currentBeat,
    currentBank: defaultCategoryState.currentBank,
    waitingForMetronome: false,
    waitingBankChange: null,
    banks: defaultCategoryState.banks,
    settings: defaultCategoryState.settings,
    selectedBeat: defaultCategoryState.selectedBeat,
    presets: defaultCategoryState.presets,
    clipboard: defaultCategoryState.clipboard,
    activeCategory: DEFAULT_CATEGORY,
    categoryStates: {
      [DEFAULT_CATEGORY]: defaultCategoryState,
    },
    isCollapsed: false,
  };
};

// Initial state
const initialState: SequencerState = createInitialSequencerState();

export const useSequencerStore = create<SequencerStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        setIsCollapsed: (isCollapsed) => set({ isCollapsed }),

        // Step management
        addStep: (bankId, beat, note, velocity = SEQUENCER_CONSTANTS.DEFAULT_VELOCITY, gate = SEQUENCER_CONSTANTS.DEFAULT_GATE) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const existingStepIndex = bank.steps.findIndex(
              step => step.beat === beat && step.note === note
            );

            let newSteps: SequencerStep[];

            if (existingStepIndex >= 0) {
              // Update existing step - only if values actually changed
              const existingStep = bank.steps[existingStepIndex];
              if (existingStep.velocity === velocity &&
                existingStep.gate === gate &&
                existingStep.enabled === true) {
                // No change needed
                return state;
              }

              newSteps = [...bank.steps];
              newSteps[existingStepIndex] = {
                ...existingStep,
                velocity,
                gate,
                enabled: true,
              };
            } else {
              // Add new step
              const newStep: SequencerStep = {
                id: uuidv4(),
                beat,
                note,
                velocity,
                gate,
                enabled: true,
              };
              newSteps = [...bank.steps, newStep];
            }

            // Check if steps actually changed
            if (stepsEqual(bank.steps, newSteps)) {
              return state;
            }

            const updatedBank = { ...bank, steps: newSteps };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        removeStep: (bankId, stepId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const updatedBank = {
              ...bank,
              steps: bank.steps.filter(step => step.id !== stepId),
            };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        updateStep: (bankId, beat, note, updates) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const stepIndex = bank.steps.findIndex(step => step.beat === beat && step.note === note);
            if (stepIndex === -1) return state;

            const updatedSteps = [...bank.steps];
            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...updates };

            const updatedBank = { ...bank, steps: updatedSteps };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        toggleStep: (bankId, beat, note) => {
          const state = get();
          const bank = state.banks[bankId];
          if (!bank) return;

          const existingStep = bank.steps.find(
            step => step.beat === beat && step.note === note
          );

          if (existingStep) {
            state.removeStep(bankId, existingStep.id);
          } else {
            state.addStep(bankId, beat, note);
          }
        },

        clearBeat: (bankId, beat) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const newSteps = bank.steps.filter(step => step.beat !== beat);

            // Check if steps actually changed
            if (arraysShallowEqual(bank.steps, newSteps)) {
              return state;
            }

            const updatedBank = {
              ...bank,
              steps: newSteps,
            };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        clearBank: (bankId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const updatedBank = { ...bank, steps: [] };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        clearAllBanks: () => {
          set((state) => {
            const updatedBanks = { ...state.banks };
            Object.keys(updatedBanks).forEach(bankId => {
              updatedBanks[bankId] = { ...updatedBanks[bankId], steps: [] };
            });

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        // Bank management
        switchBank: (bankId) => {

          set((state) => {
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              currentBank: bankId,
            });

            return {
              currentBank: bankId,
              categoryStates: nextCategoryStates,
            };
          });

        },

        toggleBankEnabled: (bankId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            const updatedBank = { ...bank, enabled: !bank.enabled };
            const updatedBanks = {
              ...state.banks,
              [bankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        duplicateBank: (fromBankId, toBankId) => {
          set((state) => {
            const fromBank = state.banks[fromBankId];
            const toBank = state.banks[toBankId];
            if (!fromBank || !toBank) return state;

            const duplicatedSteps = fromBank.steps.map(step => ({
              ...step,
              id: uuidv4(), // Generate new IDs
            }));

            const updatedBank = {
              ...toBank,
              steps: duplicatedSteps,
            };
            const updatedBanks = {
              ...state.banks,
              [toBankId]: updatedBank,
            };

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: updatedBanks,
            });

            return {
              banks: updatedBanks,
              categoryStates: nextCategoryStates,
            };
          });
        },

        copyBank: (bankId) => {
          const state = get();
          const bank = state.banks[bankId];
          if (!bank) return;

          const copiedBankData = {
            steps: bank.steps.map(step => ({
              ...step,
              id: uuidv4(), // Generate new IDs for the copied data
            })),
            timestamp: Date.now(),
          };

          set((currentState) => {
            const { nextCategoryStates } = buildCategoryUpdate(currentState, {
              clipboard: copiedBankData,
            });

            return {
              clipboard: copiedBankData,
              categoryStates: nextCategoryStates,
            };
          });

        },

        pasteBank: (bankId) => {
          const state = get();
          const bank = state.banks[bankId];
          if (!bank) return;

          if (!state.clipboard) {

            return;
          }

          // Check if clipboard is still valid (within 1 hour)
          const clipboardAge = Date.now() - state.clipboard.timestamp;
          if (clipboardAge > 60 * 60 * 1000) {

            set((currentState) => {
              const { nextCategoryStates } = buildCategoryUpdate(currentState, {
                clipboard: null,
              });

              return {
                clipboard: null,
                categoryStates: nextCategoryStates,
              };
            });
            return;
          }

          try {
            const copiedSteps = state.clipboard.steps.map((step: SequencerStep) => ({
              ...step,
              id: uuidv4(), // Generate new IDs for the pasted data
            }));

            set((currentState) => {
              const currentBank = currentState.banks[bankId];
              if (!currentBank) {
                return currentState;
              }

              const updatedBank = {
                ...currentBank,
                steps: copiedSteps,
              };

              const updatedBanks = {
                ...currentState.banks,
                [bankId]: updatedBank,
              };

              const { nextCategoryStates } = buildCategoryUpdate(currentState, {
                banks: updatedBanks,
              });

              return {
                banks: updatedBanks,
                categoryStates: nextCategoryStates,
              };
            });


          } catch (error) {
            console.error('🎵 Error pasting bank data:', error);
          }
        },

        clearClipboard: () => {
          set((state) => {
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              clipboard: null,
            });

            return {
              clipboard: null,
              categoryStates: nextCategoryStates,
            };
          });
        },

        // Playback control
        play: () => {
          set({ isPlaying: true, waitingForMetronome: true });
        },

        // Note: This is now hardStop - immediate stop with note-off
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

        // Renamed: What was previously "pause" is now "soft stop" - stops at sequence end
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
            // If playing, trigger soft stop (wait for sequence end)
            state.pause(); // This now triggers soft stop
          } else {
            // If not playing, start playing
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

        // Recording
        toggleRecording: () => {
          set((state) => ({ isRecording: !state.isRecording }));
        },

        recordStep: (note, velocity, gate, isRealtime = false) => {
          const state = get();
          if (!state.isRecording) return;

          // Determine gate value based on context
          let finalGate: number;
          if (gate !== undefined) {
            // Use provided gate (e.g., from MIDI or explicit setting)
            finalGate = gate;
          } else if (isRealtime && state.isPlaying) {
            // Real-time recording while playing - use 100% gate for legato
            finalGate = 1.0;
          } else {
            // Pause/stop recording or non-realtime - use default gate
            finalGate = SEQUENCER_CONSTANTS.DEFAULT_GATE;
          }

          state.addStep(
            state.currentBank,
            state.currentBeat,
            note,
            velocity || SEQUENCER_CONSTANTS.DEFAULT_VELOCITY,
            finalGate
          );
        },

        // Settings
        updateSettings: (updates) => {
          set((state) => {
            const newSettings = { ...state.settings, ...updates };

            // Check if settings actually changed
            if (shallowEqual(state.settings, newSettings)) {
              return state;
            }

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: newSettings,
            });

            return {
              settings: newSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setSpeed: (speed) => {
          set((state) => {
            const updatedSettings = { ...state.settings, speed };
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: updatedSettings,
            });

            return {
              settings: updatedSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setLength: (length) => {
          const clampedLength = Math.max(SEQUENCER_CONSTANTS.MIN_BEATS, Math.min(SEQUENCER_CONSTANTS.MAX_BEATS, length));
          set((state) => {
            const updatedSettings = { ...state.settings, length: clampedLength };
            const updatedCurrentBeat = Math.min(state.currentBeat, clampedLength - 1);

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: updatedSettings,
              currentBeat: updatedCurrentBeat,
            });

            return {
              settings: updatedSettings,
              currentBeat: updatedCurrentBeat,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setBankMode: (bankMode) => {
          set((state) => {
            const updatedSettings = { ...state.settings, bankMode };
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: updatedSettings,
            });

            return {
              settings: updatedSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setDisplayMode: (displayMode) => {
          set((state) => {
            const updatedSettings = { ...state.settings, displayMode };
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: updatedSettings,
            });

            return {
              settings: updatedSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setEditMode: (editMode) => {
          set((state) => {
            const updatedSettings = { ...state.settings, editMode };
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              settings: updatedSettings,
            });

            return {
              settings: updatedSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setSelectedBeat: (beat) => {
          set((state) => {
            const maxBeat = state.settings.length - 1;
            const clampedBeat = Math.max(0, Math.min(maxBeat, beat));

            const { nextCategoryStates } = buildCategoryUpdate(state, {
              selectedBeat: clampedBeat,
            });

            return {
              selectedBeat: clampedBeat,
              categoryStates: nextCategoryStates,
            };
          });
        },





        setWaitingForMetronome: (waiting) => {
          set({ waitingForMetronome: waiting });
        },

        setWaitingBankChange: (bankId) => {
          set({ waitingBankChange: bankId });
        },

        // Preset management
        savePreset: async (name, instrumentCategory) => {
          const state = get();
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;

          // Exclude displayMode and editMode from saved settings (UI state only)
          const { speed, length, bankMode } = state.settings;
          const preset: SequencerPreset = {
            id: uuidv4(),
            name,
            banks: state.banks,
            settings: { speed, length, bankMode },
            instrumentCategory,
            createdAt: Date.now(),
          };

          if (!isGuest) {
            // Authenticated: save to API
            try {
              const serverPreset = await presetSync.saveSequencerPresetToAPI(preset);
              preset.id = serverPreset.id; // Use server ID
            } catch (error) {
              console.error("Error saving preset to API:", error);
              // Continue with local save even if API fails
            }
          }

          set((state) => {
            const updatedPresets = [...state.presets, preset];
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              presets: updatedPresets,
            });

            return {
              presets: updatedPresets,
              categoryStates: nextCategoryStates,
            };
          });
        },

        loadPreset: (presetId) => {
          const state = get();
          const preset = state.presets.find(p => p.id === presetId);
          if (!preset) return;

          set((currentState) => {
            const presetBanks = preset.banks;
            // Merge preset settings with current UI state (displayMode and editMode)
            const presetSettings: SequencerSettings = {
              ...preset.settings,
              displayMode: currentState.settings.displayMode,
              editMode: currentState.settings.editMode,
            };

            const { nextCategoryStates } = buildCategoryUpdate(currentState, {
              banks: presetBanks,
              settings: presetSettings,
              currentBeat: 0,
              selectedBeat: 0,
            });

            return {
              banks: presetBanks,
              settings: presetSettings,
              currentBeat: 0,
              selectedBeat: 0,
              categoryStates: nextCategoryStates,
            };
          });
        },

        deletePreset: async (presetId) => {
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;

          if (!isGuest) {
            // Authenticated: delete from API
            try {
              await presetSync.deleteSequencerPresetFromAPI(presetId);
            } catch (error) {
              console.error("Error deleting preset from API:", error);
              // Continue with local delete even if API fails
            }
          }

          set((state) => {
            const updatedPresets = state.presets.filter(p => p.id !== presetId);
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              presets: updatedPresets,
            });

            return {
              presets: updatedPresets,
              categoryStates: nextCategoryStates,
            };
          });
        },

        exportPreset: (presetId) => {
          const state = get();
          const preset = state.presets.find(p => p.id === presetId);
          return preset ? JSON.stringify(preset, null, 2) : "";
        }, importPreset: async (presetData) => {
          try {
            const { isAuthenticated, userType } = useUserStore.getState();
            const isGuest = userType === "GUEST" || !isAuthenticated;

            const preset: SequencerPreset = JSON.parse(presetData);
            // Regenerate ID to avoid conflicts
            preset.id = uuidv4();
            preset.createdAt = Date.now();

            if (!isGuest) {
              // Authenticated: save to API
              try {
                const serverPreset = await presetSync.saveSequencerPresetToAPI(preset);
                preset.id = serverPreset.id; // Use server ID
              } catch (error) {
                console.error("Error saving imported preset to API:", error);
                // Continue with local import even if API fails
              }
            }

            set((state) => {
              const updatedPresets = [...state.presets, preset];
              const { nextCategoryStates } = buildCategoryUpdate(state, {
                presets: updatedPresets,
              });

              return {
                presets: updatedPresets,
                categoryStates: nextCategoryStates,
              };
            });
          } catch (error) {
            console.error("Failed to import preset:", error);
          }
        },

        // Load presets from API
        loadPresetsFromAPI: async () => {
          try {
            const apiPresets = await presetSync.loadSequencerPresetsFromAPI();
            set((state) => {
              const { nextCategoryStates } = buildCategoryUpdate(state, {
                presets: apiPresets,
              });
              return {
                presets: apiPresets,
                categoryStates: nextCategoryStates,
              };
            });
          } catch (error) {
            console.error("Error loading presets from API:", error);
          }
        },

        // Sync local presets to API (for migration)
        syncPresetsToAPI: async () => {
          const state = get();
          await presetSync.syncPresetsToAPI(state.presets);
        },

        // Utility functions
        getStepsForBeat: (bankId, beat) => {
          const bank = get().banks[bankId];
          return bank ? bank.steps.filter(step => step.beat === beat && step.enabled) : [];
        },

        getActiveStepsForBeat: (beat) => {
          const state = get();
          return state.getStepsForBeat(state.currentBank, beat);
        },

        hasStepAtBeat: (bankId, beat, note) => {
          const steps = get().getStepsForBeat(bankId, beat);
          return steps.some(step => step.note === note);
        },

        getNextEnabledBank: () => {
          const state = get();
          const bankNames = SEQUENCER_CONSTANTS.BANK_NAMES;

          // Get all enabled banks in order
          const enabledBanks = bankNames.filter(name => state.banks[name]?.enabled);


          if (enabledBanks.length === 0) {

            return null;
          }

          // Find current bank position in enabled banks list
          const currentIndex = enabledBanks.indexOf(state.currentBank as BankName);

          if (currentIndex === -1) {
            // Current bank is not enabled, return first enabled bank

            return enabledBanks[0];
          }

          // Get next enabled bank (cycle back to first if at end)
          const nextIndex = (currentIndex + 1) % enabledBanks.length;
          const nextBank = enabledBanks[nextIndex];


          return nextBank;
        },

        getBeatStepsCount: (bankId, beat) => {
          return get().getStepsForBeat(bankId, beat).length;
        },

        getTotalStepsCount: (bankId) => {
          const bank = get().banks[bankId];
          return bank ? bank.steps.filter(step => step.enabled).length : 0;
        },

        // Reset
        reset: () => {
          set(createInitialSequencerState());
        },

        // Reset UI state (useful when entering new room)
        resetUI: () => {
          set((state) => {
            const updatedSettings: SequencerSettings = {
              ...state.settings,
              editMode: "note" as EditMode,
            };
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              selectedBeat: 0,
              settings: updatedSettings,
            });

            return {
              selectedBeat: 0,
              settings: updatedSettings,
              categoryStates: nextCategoryStates,
            };
          });
        },

        setActiveCategory: (category) => {
          set((state) => {
            const { nextCategoryStates } = buildCategoryUpdate(state, {
              banks: state.banks,
              settings: state.settings,
              currentBank: state.currentBank,
              currentBeat: state.currentBeat,
              selectedBeat: state.selectedBeat,
              presets: state.presets,
              clipboard: state.clipboard,
            });

            const workingState: SequencerState = {
              ...state,
              categoryStates: nextCategoryStates,
            };

            const { categoryState, categoryStates } = ensureCategoryState(
              workingState,
              category
            );

            return {
              activeCategory: category,
              banks: categoryState.banks,
              settings: categoryState.settings,
              currentBank: categoryState.currentBank,
              currentBeat: categoryState.currentBeat,
              selectedBeat: categoryState.selectedBeat,
              presets: categoryState.presets,
              clipboard: categoryState.clipboard,
              isPlaying: false,
              isRecording: false,
              softStopRequested: false,
              waitingForMetronome: false,
              waitingBankChange: null,
              categoryStates,
            };
          });
        },
      }),
      {
        name: "sequencer-store",
        storage: createJSONStorage(() => persistenceStorage),
        version: 1,
        // Only persist certain parts of the state
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
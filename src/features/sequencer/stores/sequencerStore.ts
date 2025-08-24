import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
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

  // Preset management
  savePreset: (name: string, instrumentCategory: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  exportPreset: (presetId: string) => string;
  importPreset: (presetData: string) => void;

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

// Initial state
const initialState: SequencerState = {
  isPlaying: false,
  isPaused: false,
  isRecording: false,
  softStopRequested: false,
  currentBeat: 0,
  currentBank: "A",
  waitingForMetronome: false,
  waitingBankChange: null,
  banks: createDefaultBanks(),
  settings: {
    speed: SEQUENCER_CONSTANTS.DEFAULT_SPEED,
    length: SEQUENCER_CONSTANTS.DEFAULT_LENGTH,
    bankMode: "single",
    displayMode: "scale_notes",
    editMode: "note",
  },
  selectedBeat: 0,
  presets: [],
  clipboard: null,
};

export const useSequencerStore = create<SequencerStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

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

            return {
              banks: {
                ...state.banks,
                [bankId]: { ...bank, steps: newSteps },
              },
            };
          });
        },

        removeStep: (bankId, stepId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            return {
              banks: {
                ...state.banks,
                [bankId]: {
                  ...bank,
                  steps: bank.steps.filter(step => step.id !== stepId),
                },
              },
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

            return {
              banks: {
                ...state.banks,
                [bankId]: { ...bank, steps: updatedSteps },
              },
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

            return {
              banks: {
                ...state.banks,
                [bankId]: {
                  ...bank,
                  steps: newSteps,
                },
              },
            };
          });
        },

        clearBank: (bankId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            return {
              banks: {
                ...state.banks,
                [bankId]: { ...bank, steps: [] },
              },
            };
          });
        },

        clearAllBanks: () => {
          set((state) => {
            const updatedBanks = { ...state.banks };
            Object.keys(updatedBanks).forEach(bankId => {
              updatedBanks[bankId] = { ...updatedBanks[bankId], steps: [] };
            });

            return { banks: updatedBanks };
          });
        },

        // Bank management
        switchBank: (bankId) => {
          console.log(`🎵 switchBank: changing from ${get().currentBank} to ${bankId}`);
          set({ currentBank: bankId });
          console.log(`🎵 switchBank: changed to ${get().currentBank}`);
        },

        toggleBankEnabled: (bankId) => {
          set((state) => {
            const bank = state.banks[bankId];
            if (!bank) return state;

            return {
              banks: {
                ...state.banks,
                [bankId]: { ...bank, enabled: !bank.enabled },
              },
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

            return {
              banks: {
                ...state.banks,
                [toBankId]: {
                  ...toBank,
                  steps: duplicatedSteps,
                },
              },
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
          
          set({ clipboard: copiedBankData });
          console.log(`🎵 Copied bank ${bankId} with ${bank.steps.length} steps`);
        },

        pasteBank: (bankId) => {
          const state = get();
          const bank = state.banks[bankId];
          if (!bank) return;

          if (!state.clipboard) {
            console.log('🎵 No copied bank data found');
            return;
          }

          // Check if clipboard is still valid (within 1 hour)
          const clipboardAge = Date.now() - state.clipboard.timestamp;
          if (clipboardAge > 60 * 60 * 1000) {
            console.log('🎵 Clipboard data expired, clearing');
            set({ clipboard: null });
            return;
          }

          try {
            const copiedSteps = state.clipboard.steps.map((step: SequencerStep) => ({
              ...step,
              id: uuidv4(), // Generate new IDs for the pasted data
            }));

            set((state) => ({
              banks: {
                ...state.banks,
                [bankId]: {
                  ...state.banks[bankId],
                  steps: copiedSteps,
                },
              },
            }));

            console.log(`🎵 Pasted ${copiedSteps.length} steps to bank ${bankId}`);
          } catch (error) {
            console.error('🎵 Error pasting bank data:', error);
          }
        },

        clearClipboard: () => {
          set({ clipboard: null });
        },

        // Playback control
        play: () => {
          set({ isPlaying: true, isPaused: false, waitingForMetronome: true });
        },

        // Note: This is now hardStop - immediate stop with note-off
        stop: () => {
          set({ 
            isPlaying: false, 
            isPaused: false, 
            softStopRequested: false,
            currentBeat: 0,
            waitingForMetronome: false,
            waitingBankChange: null,
          });
        },

        pause: () => {
          set({ isPlaying: false, isPaused: true });
        },

        softStop: () => {
          set({ softStopRequested: true });
        },

        cancelSoftStop: () => {
          set({ softStopRequested: false });
        },

        hardStop: () => {
          set({ 
            isPlaying: false, 
            isPaused: false, 
            softStopRequested: false,
            currentBeat: 0,
            waitingForMetronome: false,
            waitingBankChange: null,
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
          console.log(`🎵 setCurrentBeat: updating from ${get().currentBeat} to ${beat}`);
          set({ currentBeat: Math.max(0, Math.min(get().settings.length - 1, beat)) });
          console.log(`🎵 setCurrentBeat: updated to ${get().currentBeat}`);
        },

        nextBeat: () => {
          const state = get();
          const nextBeat = (state.currentBeat + 1) % state.settings.length;
          
          // Handle bank switching in continuous mode
          if (nextBeat === 0 && state.settings.bankMode === "continuous") {
            const nextBank = state.getNextEnabledBank();
            if (nextBank && nextBank !== state.currentBank) {
              set({ currentBank: nextBank });
            }
          }
          
          state.setCurrentBeat(nextBeat);
        },

        resetToStart: () => {
          set({ currentBeat: 0 });
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
            
            return {
              settings: newSettings,
            };
          });
        },

        setSpeed: (speed) => {
          set((state) => ({
            settings: { ...state.settings, speed },
          }));
        },

        setLength: (length) => {
          const clampedLength = Math.max(SEQUENCER_CONSTANTS.MIN_BEATS, Math.min(SEQUENCER_CONSTANTS.MAX_BEATS, length));
          set((state) => ({
            settings: { ...state.settings, length: clampedLength },
            currentBeat: Math.min(state.currentBeat, clampedLength - 1),
          }));
        },

        setBankMode: (bankMode) => {
          set((state) => ({
            settings: { ...state.settings, bankMode },
          }));
        },

        setDisplayMode: (displayMode) => {
          set((state) => ({
            settings: { ...state.settings, displayMode },
          }));
        },

        setEditMode: (editMode) => {
          set((state) => ({
            settings: { ...state.settings, editMode },
          }));
        },

        setSelectedBeat: (beat) => {
          set({ selectedBeat: Math.max(0, Math.min(get().settings.length - 1, beat)) });
        },





        setWaitingForMetronome: (waiting) => {
          set({ waitingForMetronome: waiting });
        },

        setWaitingBankChange: (bankId) => {
          set({ waitingBankChange: bankId });
        },

        // Preset management
        savePreset: (name, instrumentCategory) => {
          const state = get();
          const preset: SequencerPreset = {
            id: uuidv4(),
            name,
            banks: state.banks,
            settings: state.settings,
            instrumentCategory,
            createdAt: Date.now(),
          };

          set((state) => ({
            presets: [...state.presets, preset],
          }));
        },

        loadPreset: (presetId) => {
          const state = get();
          const preset = state.presets.find(p => p.id === presetId);
          if (!preset) return;

          set({
            banks: preset.banks,
            settings: preset.settings,
            currentBeat: 0,
            selectedBeat: 0,
          });
        },

        deletePreset: (presetId) => {
          set((state) => ({
            presets: state.presets.filter(p => p.id !== presetId),
          }));
        },

        exportPreset: (presetId) => {
          const state = get();
          const preset = state.presets.find(p => p.id === presetId);
          return preset ? JSON.stringify(preset, null, 2) : "";
        },

        importPreset: (presetData) => {
          try {
            const preset: SequencerPreset = JSON.parse(presetData);
            // Regenerate ID to avoid conflicts
            preset.id = uuidv4();
            preset.createdAt = Date.now();

            set((state) => ({
              presets: [...state.presets, preset],
            }));
          } catch (error) {
            console.error("Failed to import preset:", error);
          }
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
          console.log(`🎵 getNextEnabledBank: current=${state.currentBank}, enabled=[${enabledBanks.join(', ')}]`);
          
          if (enabledBanks.length === 0) {
            console.log(`🎵 No enabled banks found`);
            return null;
          }
          
          // Find current bank position in enabled banks list
          const currentIndex = enabledBanks.indexOf(state.currentBank as BankName);
          
          if (currentIndex === -1) {
            // Current bank is not enabled, return first enabled bank
            console.log(`🎵 Current bank ${state.currentBank} not enabled, returning first enabled: ${enabledBanks[0]}`);
            return enabledBanks[0];
          }
          
          // Get next enabled bank (cycle back to first if at end)
          const nextIndex = (currentIndex + 1) % enabledBanks.length;
          const nextBank = enabledBanks[nextIndex];
          console.log(`🎵 Next enabled bank: ${nextBank} (position ${nextIndex}/${enabledBanks.length})`);
          
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
          set(initialState);
        },

        // Reset UI state (useful when entering new room)
        resetUI: () => {
          set({ selectedBeat: 0, settings: { ...get().settings, editMode: "note" } });
        },
      }),
      {
        name: "sequencer-store",
        storage: createJSONStorage(() => localStorage),
        // Only persist certain parts of the state
        partialize: (state) => ({
          banks: state.banks,
          settings: state.settings,
          presets: state.presets,
          clipboard: state.clipboard,
          selectedBeat: state.selectedBeat,
        }),
      }
    )
  )
); 
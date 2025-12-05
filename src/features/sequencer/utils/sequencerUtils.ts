import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { DEFAULT_MELODIC_PRESETS } from "../constants/defaultPresets";
import type {
  SequencerState,
  SequencerStep,
  SequencerBank,
  SequencerCategoryState,
} from "../types";

// Constants
export const DEFAULT_CATEGORY = InstrumentCategory.Melodic;

// Shallow comparison utilities
export const shallowEqual = (obj1: any, obj2: any): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
};

export const arraysShallowEqual = <T>(arr1: T[], arr2: T[]): boolean => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
};

// Step comparison utility
export const stepsEqual = (steps1: SequencerStep[], steps2: SequencerStep[]): boolean => {
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

// Helper function to create empty bank
export const createEmptyBank = (id: string, name: string): SequencerBank => ({
  id,
  name,
  steps: [],
  enabled: true,
});

// Helper function to create default banks
export const createDefaultBanks = (): Record<string, SequencerBank> => {
  const banks: Record<string, SequencerBank> = {};
  SEQUENCER_CONSTANTS.BANK_NAMES.forEach((name) => {
    banks[name] = createEmptyBank(name, name);
  });
  return banks;
};

export const createDefaultCategoryState = (category?: string): SequencerCategoryState => {
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

export const ensureCategoryState = (
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

export const buildCategoryUpdate = (
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

export const createInitialSequencerState = (): SequencerState => {
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

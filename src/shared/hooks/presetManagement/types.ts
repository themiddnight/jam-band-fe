/**
 * Generic Preset Management System
 * 
 * This module provides a reusable preset management solution that can be used across
 * different features (synth, effect chains, sequencer, etc.) with type-specific validation.
 */

export interface BasePreset {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetBank<T extends BasePreset> {
  presets: T[];
  version: string;
}

export interface PresetValidationContext {
  // Context information for validation
  [key: string]: any;
}

export interface PresetValidator<T extends BasePreset> {
  /**
   * Validates if a preset is compatible with the current context
   * @returns { valid: boolean, message?: string }
   */
  validate: (preset: T, context: PresetValidationContext) => {
    valid: boolean;
    message?: string;
  };
}

export interface PresetManagerConfig<T extends BasePreset> {
  storageKey: string;
  version: string;
  validator?: PresetValidator<T>;
  onImportSuccess?: (presets: T[]) => void;
  onImportError?: (error: string) => void;
}

export interface PresetImportResult<T extends BasePreset> {
  success: boolean;
  importedPresets: T[];
  incompatiblePresets: T[];
  errorMessage?: string;
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
  context?: PresetValidationContext;
}

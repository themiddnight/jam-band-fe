import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePresetManager } from '../hooks/presetManagement';
import type { BasePreset, PresetValidator } from '../hooks/presetManagement';

// Test preset type
interface TestPreset extends BasePreset {
  value: string;
  category?: string;
}

describe('PresetManager - usePresetManager Hook', () => {
  const storageKey = 'test-presets';
  const version = '1.0.0';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      expect(result.current.presets).toEqual([]);
      expect(result.current.currentPreset).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load presets from localStorage on mount', async () => {
      const mockPresets: TestPreset[] = [
        {
          id: 'preset-1',
          name: 'Test Preset 1',
          value: 'test-value-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      localStorage.setItem(
        storageKey,
        JSON.stringify({ presets: mockPresets, version })
      );

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      await waitFor(() => {
        expect(result.current.presets).toHaveLength(1);
        expect(result.current.presets[0].name).toBe('Test Preset 1');
      });
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      localStorage.setItem(storageKey, 'invalid-json{]');

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.presets).toEqual([]);
      });
    });
  });

  describe('Saving Presets', () => {
    it('should save a new preset', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({
          name: 'New Preset',
          value: 'new-value',
        });
      });

      expect(result.current.presets).toHaveLength(1);
      expect(result.current.presets[0].name).toBe('New Preset');
      expect(result.current.presets[0].value).toBe('new-value');
      expect(result.current.presets[0].id).toBeTruthy();
      expect(result.current.currentPreset?.name).toBe('New Preset');
    });

    it('should persist preset to localStorage', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({
          name: 'Persist Test',
          value: 'persist-value',
        });
      });

      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.presets).toHaveLength(1);
      expect(parsed.presets[0].name).toBe('Persist Test');
      expect(parsed.version).toBe(version);
    });

    it('should generate unique IDs for presets', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({ name: 'Preset 1', value: 'value-1' });
        result.current.savePreset({ name: 'Preset 2', value: 'value-2' });
      });

      expect(result.current.presets).toHaveLength(2);
      expect(result.current.presets[0].id).not.toBe(result.current.presets[1].id);
    });
  });

  describe('Loading Presets', () => {
    it('should load a preset and set it as current', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      let savedPreset: TestPreset | undefined;

      act(() => {
        result.current.savePreset({ name: 'Load Test', value: 'load-value' });
        savedPreset = result.current.presets[0];
      });

      if (savedPreset) {
        act(() => {
          result.current.loadPreset(savedPreset!);
        });

        expect(result.current.currentPreset).toEqual(savedPreset);
      }
    });
  });

  describe('Deleting Presets', () => {
    it('should delete a preset by ID', async () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      let presetId: string;

      act(() => {
        result.current.savePreset({ name: 'Delete Test', value: 'delete-value' });
      });

      await waitFor(() => {
        expect(result.current.presets).toHaveLength(1);
        presetId = result.current.presets[0].id;
      });

      act(() => {
        result.current.deletePreset(presetId);
      });

      expect(result.current.presets).toHaveLength(0);
    });

    it('should clear current preset if deleted preset was current', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      let savedPreset: TestPreset | undefined;

      act(() => {
        result.current.savePreset({ name: 'Current', value: 'current-value' });
        savedPreset = result.current.presets[0];
        if (savedPreset) {
          result.current.loadPreset(savedPreset);
        }
      });

      expect(result.current.currentPreset).toBeTruthy();

      if (savedPreset) {
        act(() => {
          result.current.deletePreset(savedPreset!.id);
        });

        expect(result.current.currentPreset).toBeNull();
      }
    });

    it('should update localStorage after deletion', async () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      let presetId: string;

      act(() => {
        result.current.savePreset({ name: 'Preset 1', value: 'value-1' });
        result.current.savePreset({ name: 'Preset 2', value: 'value-2' });
      });

      await waitFor(() => {
        expect(result.current.presets).toHaveLength(2);
        presetId = result.current.presets[0].id;
      });

      act(() => {
        result.current.deletePreset(presetId);
      });

      const stored = localStorage.getItem(storageKey);
      const parsed = JSON.parse(stored!);
      expect(parsed.presets).toHaveLength(1);
    });
  });

  describe('Exporting Presets', () => {
    it('should export presets as JSON string', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({ name: 'Export Test', value: 'export-value' });
      });

      const exported = result.current.exportPresets();
      expect(exported).toBeTruthy();

      const parsed = JSON.parse(exported);
      expect(parsed.presets).toHaveLength(1);
      expect(parsed.presets[0].name).toBe('Export Test');
      expect(parsed.version).toBe(version);
    });

    it('should export formatted JSON with proper indentation', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({ name: 'Format Test', value: 'format-value' });
      });

      const exported = result.current.exportPresets();
      expect(exported).toContain('\n');
      expect(exported).toContain('  ');
    });
  });

  describe('Importing Presets', () => {
    it('should import presets from valid JSON data', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      const importData = JSON.stringify({
        presets: [
          {
            id: 'imported-1',
            name: 'Imported Preset',
            value: 'imported-value',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      act(() => {
        result.current.importPresetsFromData(importData, { mode: 'merge' });
      });

      expect(result.current.presets).toHaveLength(1);
      expect(result.current.presets[0].name).toBe('Imported Preset');
    });

    it('should merge imported presets with existing ones', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({ name: 'Existing', value: 'existing-value' });
      });

      const importData = JSON.stringify({
        presets: [
          {
            id: 'imported-1',
            name: 'Imported',
            value: 'imported-value',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      act(() => {
        result.current.importPresetsFromData(importData, { mode: 'merge' });
      });

      expect(result.current.presets).toHaveLength(2);
    });

    it('should replace presets when mode is replace', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.savePreset({ name: 'Existing', value: 'existing-value' });
      });

      const importData = JSON.stringify({
        presets: [
          {
            id: 'imported-1',
            name: 'Imported',
            value: 'imported-value',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      act(() => {
        result.current.importPresetsFromData(importData, { mode: 'replace' });
      });

      expect(result.current.presets).toHaveLength(1);
      expect(result.current.presets[0].name).toBe('Imported');
    });

    it('should handle invalid import data gracefully', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      const importResult = result.current.importPresetsFromData('invalid-json', {
        mode: 'merge',
      });

      expect(importResult.success).toBe(false);
      expect(importResult.errorMessage).toBeTruthy();
      expect(result.current.presets).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should validate presets during import when validator is provided', async () => {
      const validator: PresetValidator<TestPreset> = {
        validate: (preset: TestPreset, context: any) => {
          if (preset.category !== context.requiredCategory) {
            return { valid: false, message: 'Category mismatch' };
          }
          return { valid: true };
        },
      };

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
          validator,
        })
      );

      const importData = JSON.stringify({
        presets: [
          {
            id: 'preset-1',
            name: 'Valid Preset',
            value: 'value-1',
            category: 'synth',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'preset-2',
            name: 'Invalid Preset',
            value: 'value-2',
            category: 'drum',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      let importResult: any;
      act(() => {
        importResult = result.current.importPresetsFromData(importData, {
          mode: 'merge',
          context: { requiredCategory: 'synth' },
        });
      });

      await waitFor(() => {
        expect(result.current.presets).toHaveLength(1);
      });

      expect(importResult!.success).toBe(true);
      expect(importResult!.importedPresets).toHaveLength(1);
      expect(importResult!.incompatiblePresets).toHaveLength(1);
      expect(result.current.presets[0].name).toBe('Valid Preset');
    });

    it('should reject all presets if none are compatible', () => {
      const validator: PresetValidator<TestPreset> = {
        validate: () => ({ valid: false, message: 'All invalid' }),
      };

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
          validator,
        })
      );

      const importData = JSON.stringify({
        presets: [
          {
            id: 'preset-1',
            name: 'Invalid',
            value: 'value-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      const importResult = result.current.importPresetsFromData(importData, {
        mode: 'merge',
      });

      expect(importResult.success).toBe(false);
      expect(result.current.presets).toHaveLength(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onImportSuccess callback after successful import', () => {
      const onImportSuccess = vi.fn();

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
          onImportSuccess,
        })
      );

      const importData = JSON.stringify({
        presets: [
          {
            id: 'preset-1',
            name: 'Test',
            value: 'value-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        version,
      });

      act(() => {
        result.current.importPresetsFromData(importData, { mode: 'merge' });
      });

      expect(onImportSuccess).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Test' }),
        ])
      );
    });

    it('should call onImportError callback on import failure', () => {
      const onImportError = vi.fn();

      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
          onImportError,
        })
      );

      act(() => {
        result.current.importPresetsFromData('invalid-json', { mode: 'merge' });
      });

      expect(onImportError).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('Error Handling', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() =>
        usePresetManager<TestPreset>({
          storageKey,
          version,
        })
      );

      act(() => {
        result.current.importPresetsFromData('invalid', { mode: 'merge' });
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});

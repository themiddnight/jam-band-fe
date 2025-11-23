import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSequencerStore } from '../stores/sequencerStore';
import { InstrumentCategory } from '../../../shared/constants/instruments';
import type { SequencerPreset } from '../types';

/**
 * Sequencer Presets Integration Tests
 * Tests the integration of preset management with sequencer functionality
 */
describe('Sequencer Presets Integration', () => {
  beforeEach(() => {
    // Clear localStorage to prevent state persistence between tests
    localStorage.clear();
    
    const { result } = renderHook(() => useSequencerStore());
    act(() => {
      // Clear all existing presets
      const currentPresets = result.current.presets;
      currentPresets.forEach(preset => {
        result.current.deletePreset(preset.id);
      });
      
      result.current.clearAllBanks();
      result.current.updateSettings({
        speed: 1,
        length: 16,
        bankMode: 'single',
        displayMode: 'all_notes',
        editMode: 'note',
      });
    });
  });

  describe('Preset Saving', () => {
    it('should save sequencer state as preset with all bank data', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Add some steps to bank A
      act(() => {
        result.current.addStep('A', 0, 'C4', 0.8, 0.5);
        result.current.addStep('A', 4, 'E4', 0.7, 0.5);
        result.current.addStep('A', 8, 'G4', 0.9, 0.5);
      });

      // Save as preset
      act(() => {
        result.current.savePreset('Test Pattern', InstrumentCategory.Melodic);
      });

      const presets = result.current.presets;
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Test Pattern');
      expect(presets[0].instrumentCategory).toBe(InstrumentCategory.Melodic);
      expect(presets[0].banks.A.steps).toHaveLength(3);
    });

    it('should save current settings with preset', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.updateSettings({
          speed: 2,
          length: 8,
          bankMode: 'continuous',
        });
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Settings Test', InstrumentCategory.Synthesizer);
      });

      const preset = result.current.presets[0];
      expect(preset.settings.speed).toBe(2);
      expect(preset.settings.length).toBe(8);
      expect(preset.settings.bankMode).toBe('continuous');
    });

    it('should save all four banks with preset', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('B', 1, 'D4');
        result.current.addStep('C', 2, 'E4');
        result.current.addStep('D', 3, 'F4');
        result.current.savePreset('Four Banks', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      expect(preset.banks.A.steps).toHaveLength(1);
      expect(preset.banks.B.steps).toHaveLength(1);
      expect(preset.banks.C.steps).toHaveLength(1);
      expect(preset.banks.D.steps).toHaveLength(1);
    });
  });

  describe('Preset Loading', () => {
    it('should restore bank data when loading preset', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Create and save a preset
      act(() => {
        result.current.addStep('A', 0, 'C4', 0.8, 0.5);
        result.current.addStep('A', 4, 'E4', 0.7, 0.5);
        result.current.savePreset('Pattern 1', InstrumentCategory.Melodic);
      });

      const savedPreset = result.current.presets[0];

      // Clear the sequencer
      act(() => {
        result.current.clearAllBanks();
      });

      expect(result.current.banks.A.steps).toHaveLength(0);

      // Load the preset
      act(() => {
        result.current.loadPreset(savedPreset.id);
      });

      expect(result.current.banks.A.steps).toHaveLength(2);
      expect(result.current.banks.A.steps[0].note).toBe('C4');
      expect(result.current.banks.A.steps[1].note).toBe('E4');
    });

    it('should restore settings when loading preset', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Create preset with specific settings
      act(() => {
        result.current.updateSettings({
          speed: 4,
          length: 12,
          bankMode: 'continuous',
        });
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Settings Pattern', InstrumentCategory.Synthesizer);
      });

      const savedPreset = result.current.presets[0];

      // Change settings
      act(() => {
        result.current.updateSettings({
          speed: 1,
          length: 16,
          bankMode: 'single',
        });
      });

      // Load preset
      act(() => {
        result.current.loadPreset(savedPreset.id);
      });

      expect(result.current.settings.speed).toBe(4);
      expect(result.current.settings.length).toBe(12);
      expect(result.current.settings.bankMode).toBe('continuous');
    });

    it('should replace existing pattern with loaded preset', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Create first pattern
      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('A', 4, 'D4');
        result.current.savePreset('Pattern 1', InstrumentCategory.Melodic);
      });

      const firstPreset = result.current.presets[0];

      // Create second pattern
      act(() => {
        result.current.clearAllBanks();
        result.current.addStep('A', 0, 'G4');
        result.current.addStep('A', 8, 'A4');
        result.current.savePreset('Pattern 2', InstrumentCategory.Melodic);
      });

      // Load first pattern back
      act(() => {
        result.current.loadPreset(firstPreset.id);
      });

      expect(result.current.banks.A.steps).toHaveLength(2);
      expect(result.current.banks.A.steps[0].note).toBe('C4');
      expect(result.current.banks.A.steps[1].note).toBe('D4');
    });
  });

  describe('Preset Deletion', () => {
    it('should remove preset from store', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('To Delete', InstrumentCategory.Melodic);
      });

      const presetId = result.current.presets[0].id;

      act(() => {
        result.current.deletePreset(presetId);
      });

      expect(result.current.presets).toHaveLength(0);
    });

    it('should handle deleting non-existent preset gracefully', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Existing', InstrumentCategory.Melodic);
      });

      expect(result.current.presets).toHaveLength(1);

      act(() => {
        result.current.deletePreset('non-existent-id');
      });

      expect(result.current.presets).toHaveLength(1);
    });
  });

  describe('Category-Specific Presets', () => {
    it('should save drum presets with drum category', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C1'); // kick in GM percussion
        result.current.addStep('A', 4, 'D#1'); // snare in GM percussion
        result.current.savePreset('Drum Beat', InstrumentCategory.DrumBeat);
      });

      const preset = result.current.presets[0];
      expect(preset.instrumentCategory).toBe(InstrumentCategory.DrumBeat);
    });

    it('should save melodic presets with appropriate category', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('A', 4, 'E4');
        result.current.addStep('A', 8, 'G4');
        result.current.savePreset('Melody', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      expect(preset.instrumentCategory).toBe(InstrumentCategory.Melodic);
    });

    it('should filter presets by category correctly', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Create drum preset
      act(() => {
        result.current.addStep('A', 0, 'C1');
        result.current.savePreset('Drums', InstrumentCategory.DrumBeat);
      });

      // Create synth preset
      act(() => {
        result.current.clearAllBanks();
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Synth', InstrumentCategory.Melodic);
      });

      const drumPresets = result.current.presets.filter(
        (p) => p.instrumentCategory === InstrumentCategory.DrumBeat
      );
      const synthPresets = result.current.presets.filter(
        (p) => p.instrumentCategory === InstrumentCategory.Melodic
      );

      expect(drumPresets).toHaveLength(1);
      expect(synthPresets).toHaveLength(1);
      expect(drumPresets[0].name).toBe('Drums');
      expect(synthPresets[0].name).toBe('Synth');
    });
  });

  describe('Multi-Bank Presets', () => {
    it('should handle continuous bank mode presets', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.updateSettings({ bankMode: 'continuous' });
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('B', 0, 'D4');
        result.current.toggleBankEnabled('A');
        result.current.toggleBankEnabled('B');
        result.current.savePreset('Continuous', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      expect(preset.settings.bankMode).toBe('continuous');

      act(() => {
        result.current.loadPreset(preset.id);
      });

      expect(result.current.settings.bankMode).toBe('continuous');
    });

    it('should preserve bank enabled states in presets', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('B', 0, 'D4');
        result.current.toggleBankEnabled('B'); // Enable bank B
        result.current.savePreset('Multi Bank', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];

      act(() => {
        result.current.clearAllBanks();
        result.current.loadPreset(preset.id);
      });

      expect(result.current.banks.B.enabled).toBe(true);
    });
  });

  describe('Preset Data Integrity', () => {
    it('should preserve step properties (velocity, gate) in presets', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4', 0.75, 0.3);
        result.current.addStep('A', 4, 'E4', 0.9, 0.8);
        result.current.savePreset('Velocity Test', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];

      act(() => {
        result.current.clearAllBanks();
        result.current.loadPreset(preset.id);
      });

      const steps = result.current.banks.A.steps;
      expect(steps[0].velocity).toBe(0.75);
      expect(steps[0].gate).toBe(0.3);
      expect(steps[1].velocity).toBe(0.9);
      expect(steps[1].gate).toBe(0.8);
    });

    it('should maintain consistent step IDs when loading presets', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.addStep('A', 4, 'E4');
        result.current.savePreset('ID Test', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      const presetStepIds = preset.banks.A.steps.map((s) => s.id);

      act(() => {
        result.current.clearAllBanks();
        result.current.loadPreset(preset.id);
      });

      const loadedStepIds = result.current.banks.A.steps.map((s) => s.id);

      // IDs should be preserved from the preset
      expect(loadedStepIds[0]).toBe(presetStepIds[0]);
      expect(loadedStepIds[1]).toBe(presetStepIds[1]);
      // And should still be unique
      expect(loadedStepIds[0]).not.toBe(loadedStepIds[1]);
    });

    it('should handle empty banks in presets', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        // Banks B, C, D remain empty
        result.current.savePreset('Sparse', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];

      act(() => {
        result.current.loadPreset(preset.id);
      });

      expect(result.current.banks.A.steps).toHaveLength(1);
      expect(result.current.banks.B.steps).toHaveLength(0);
      expect(result.current.banks.C.steps).toHaveLength(0);
      expect(result.current.banks.D.steps).toHaveLength(0);
    });
  });

  describe('Preset Persistence', () => {
    it('should create preset with timestamp', () => {
      const { result } = renderHook(() => useSequencerStore());

      const beforeTime = Date.now();

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Timestamp Test', InstrumentCategory.Melodic);
      });

      const afterTime = Date.now();
      const preset = result.current.presets[0];

      expect(preset.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(preset.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('should generate unique preset IDs', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset('Preset 1', InstrumentCategory.Melodic);
        result.current.savePreset('Preset 2', InstrumentCategory.Melodic);
      });

      const presets = result.current.presets;
      expect(presets[0].id).not.toBe(presets[1].id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle loading preset with missing banks gracefully', () => {
      const { result } = renderHook(() => useSequencerStore());

      // Create a malformed preset (simulating corrupted data)
      const malformedPreset: SequencerPreset = {
        id: 'malformed',
        name: 'Malformed',
        banks: {
          A: { id: 'A', name: 'A', steps: [], enabled: false },
        } as any, // Missing B, C, D
        settings: {
          speed: 1,
          length: 16,
          bankMode: 'single',
        },
        instrumentCategory: InstrumentCategory.Melodic,
        createdAt: Date.now(),
      };

      act(() => {
        result.current.loadPreset(malformedPreset.id);
      });

      // Should not crash and should initialize missing banks
      expect(result.current.banks.A).toBeTruthy();
      expect(result.current.banks.B).toBeTruthy();
      expect(result.current.banks.C).toBeTruthy();
      expect(result.current.banks.D).toBeTruthy();
    });

    it('should handle saving preset with no steps', () => {
      const { result } = renderHook(() => useSequencerStore());

      act(() => {
        result.current.clearAllBanks();
        result.current.savePreset('Empty Pattern', InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      expect(preset.banks.A.steps).toHaveLength(0);
      expect(preset.banks.B.steps).toHaveLength(0);
      expect(preset.banks.C.steps).toHaveLength(0);
      expect(preset.banks.D.steps).toHaveLength(0);
    });

    it('should handle preset names with special characters', () => {
      const { result } = renderHook(() => useSequencerStore());

      const specialName = 'Pattern-#1_[Test] (v2.0) 🎵';

      act(() => {
        result.current.addStep('A', 0, 'C4');
        result.current.savePreset(specialName, InstrumentCategory.Melodic);
      });

      const preset = result.current.presets[0];
      expect(preset.name).toBe(specialName);
    });
  });
});

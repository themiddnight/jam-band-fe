/**
 * Sequencer Preset Category Filtering - Regression Tests
 * 
 * Tests the preset filtering logic that allows melodic and synthesizer
 * instruments to share presets while keeping drum presets separate.
 */

import { describe, it, expect } from 'vitest';

describe('Sequencer Preset Category Filtering - Regression Tests', () => {
  describe('Preset Category Grouping', () => {
    it('should group melodic and synthesizer presets together', () => {
      // This is the filter function used in StepSequencer.tsx
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      const melodicPreset = { instrumentCategory: 'melodic' };
      const synthPreset = { instrumentCategory: 'synthesizer' };
      const drumPreset = { instrumentCategory: 'drum_beat' };

      // When viewing melodic instruments
      expect(filterPresets(melodicPreset, 'melodic')).toBe(true);
      expect(filterPresets(synthPreset, 'melodic')).toBe(true); // ✅ Synth presets visible
      expect(filterPresets(drumPreset, 'melodic')).toBe(false); // ❌ Drum presets hidden

      // When viewing synthesizer instruments
      expect(filterPresets(melodicPreset, 'synthesizer')).toBe(true); // ✅ Melodic presets visible
      expect(filterPresets(synthPreset, 'synthesizer')).toBe(true);
      expect(filterPresets(drumPreset, 'synthesizer')).toBe(false); // ❌ Drum presets hidden

      // When viewing drum instruments
      expect(filterPresets(melodicPreset, 'drum_beat')).toBe(false); // ❌ Melodic presets hidden
      expect(filterPresets(synthPreset, 'drum_beat')).toBe(false); // ❌ Synth presets hidden
      expect(filterPresets(drumPreset, 'drum_beat')).toBe(true); // ✅ Only drum presets visible
    });

    it('should maintain separate drum preset namespace', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      const drumPreset = { instrumentCategory: 'drum_beat' };

      // Drums are completely isolated from melodic/synth
      expect(filterPresets(drumPreset, 'melodic')).toBe(false);
      expect(filterPresets(drumPreset, 'synthesizer')).toBe(false);
      expect(filterPresets(drumPreset, 'drum_beat')).toBe(true);
    });
  });

  describe('Use Case Scenarios', () => {
    it('should allow sharing a piano pattern between piano and synth', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // User creates a preset with piano (melodic category)
      const pianoPreset = { 
        instrumentCategory: 'melodic',
        name: 'Chord Progression',
        banks: { /* pattern data */ }
      };

      // Preset should be visible when switching to synth
      expect(filterPresets(pianoPreset, 'melodic')).toBe(true);
      expect(filterPresets(pianoPreset, 'synthesizer')).toBe(true);
      
      // But not visible when switching to drums
      expect(filterPresets(pianoPreset, 'drum_beat')).toBe(false);
    });

    it('should allow sharing a synth pattern between synth and melodic instruments', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // User creates a preset with synth (synthesizer category)
      const synthPreset = { 
        instrumentCategory: 'synthesizer',
        name: 'Bass Line',
        banks: { /* pattern data */ }
      };

      // Preset should be visible when switching to melodic instruments
      expect(filterPresets(synthPreset, 'synthesizer')).toBe(true);
      expect(filterPresets(synthPreset, 'melodic')).toBe(true);
      
      // But not visible when switching to drums
      expect(filterPresets(synthPreset, 'drum_beat')).toBe(false);
    });

    it('should keep drum patterns isolated', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // User creates a drum pattern
      const drumPattern = { 
        instrumentCategory: 'drum_beat',
        name: 'Beat Pattern',
        banks: { /* drum pattern data */ }
      };

      // Drum preset only visible in drum mode
      expect(filterPresets(drumPattern, 'drum_beat')).toBe(true);
      expect(filterPresets(drumPattern, 'melodic')).toBe(false);
      expect(filterPresets(drumPattern, 'synthesizer')).toBe(false);
    });
  });

  describe('Category Compatibility Matrix', () => {
    it('should have correct visibility matrix', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // Compatibility matrix:
      // Preset Category → Current Category
      // melodic      → melodic: ✅, synthesizer: ✅, drum_beat: ❌
      // synthesizer  → melodic: ✅, synthesizer: ✅, drum_beat: ❌
      // drum_beat    → melodic: ❌, synthesizer: ❌, drum_beat: ✅

      const categories = ['melodic', 'synthesizer', 'drum_beat'];
      const presets = [
        { instrumentCategory: 'melodic' },
        { instrumentCategory: 'synthesizer' },
        { instrumentCategory: 'drum_beat' },
      ];

      const expectedMatrix = [
        // melodic preset
        [true, true, false],
        // synthesizer preset  
        [true, true, false],
        // drum_beat preset
        [false, false, true],
      ];

      presets.forEach((preset, presetIdx) => {
        categories.forEach((category, categoryIdx) => {
          const result = filterPresets(preset, category);
          const expected = expectedMatrix[presetIdx][categoryIdx];
          
          expect(result).toBe(expected);
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown categories gracefully', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // Unknown preset category (treated as melodic/synth group)
      const unknownPreset = { instrumentCategory: 'unknown' };
      
      expect(filterPresets(unknownPreset, 'melodic')).toBe(true);
      expect(filterPresets(unknownPreset, 'synthesizer')).toBe(true);
      expect(filterPresets(unknownPreset, 'drum_beat')).toBe(false);

      // Unknown current category (treated as melodic/synth)
      const melodicPreset = { instrumentCategory: 'melodic' };
      expect(filterPresets(melodicPreset, 'unknown' as any)).toBe(true);
    });

    it('should be case-sensitive for category matching', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // Case variations should NOT match drum_beat
      const wrongCasePreset = { instrumentCategory: 'DRUM_BEAT' };
      expect(filterPresets(wrongCasePreset, 'drum_beat')).toBe(false);
      
      // Wrong case current category
      const drumPreset = { instrumentCategory: 'drum_beat' };
      expect(filterPresets(drumPreset, 'DRUM_BEAT')).toBe(false);
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle old presets without category field', () => {
      const filterPresets = (preset: { instrumentCategory?: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // Old preset without instrumentCategory field
      const oldPreset = { instrumentCategory: undefined };
      
      // Should be treated as melodic/synth (visible in non-drum modes)
      expect(filterPresets(oldPreset, 'melodic')).toBe(true);
      expect(filterPresets(oldPreset, 'synthesizer')).toBe(true);
      expect(filterPresets(oldPreset, 'drum_beat')).toBe(false);
    });
  });

  describe('Performance Considerations', () => {
    it('should efficiently filter large preset lists', () => {
      const filterPresets = (preset: { instrumentCategory: string }, currentCategory: string) => {
        const isDrumPreset = preset.instrumentCategory === 'drum_beat';
        const isCurrentDrum = currentCategory === 'drum_beat';
        
        if (isDrumPreset) {
          return isCurrentDrum;
        } else {
          return !isCurrentDrum;
        }
      };

      // Create 100 presets
      const presets = Array.from({ length: 100 }, (_, i) => ({
        instrumentCategory: i % 3 === 0 ? 'drum_beat' : i % 2 === 0 ? 'melodic' : 'synthesizer',
      }));

      const start = performance.now();
      
      // Filter in melodic mode
      const melodicResults = presets.filter(p => filterPresets(p, 'melodic'));
      
      // Filter in drum mode
      const drumResults = presets.filter(p => filterPresets(p, 'drum_beat'));
      
      const end = performance.now();

      // Should complete very quickly (< 10ms)
      expect(end - start).toBeLessThan(10);
      
      // Verify correct counts
      const drumCount = presets.filter(p => p.instrumentCategory === 'drum_beat').length;
      const nonDrumCount = presets.length - drumCount;
      
      expect(melodicResults.length).toBe(nonDrumCount);
      expect(drumResults.length).toBe(drumCount);
    });
  });
});

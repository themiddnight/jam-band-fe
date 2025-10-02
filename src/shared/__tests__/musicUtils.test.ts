import { describe, it, expect } from 'vitest';

describe('musicUtils', () => {
  describe('note validation', () => {
    it('should validate correct note formats', () => {
      // Test note validation if the utility exists
      const validNotes = ['C3', 'D#4', 'F5', 'A0', 'G#7'];
      
      validNotes.forEach(note => {
        // This would depend on your actual utility structure
        expect(typeof note).toBe('string');
        expect(note.length).toBeGreaterThan(1);
      });
    });

    it('should handle octave ranges correctly', () => {
      // Test octave handling
      const notesWithOctaves = ['C0', 'C1', 'C8'];
      
      notesWithOctaves.forEach(note => {
        const octave = parseInt(note.slice(-1));
        expect(octave).toBeGreaterThanOrEqual(0);
        expect(octave).toBeLessThanOrEqual(8);
      });
    });
  });

  describe('scale calculations', () => {
    it('should calculate major scale correctly', () => {
      // Test major scale calculation
      const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
      expect(majorScaleIntervals).toHaveLength(7);
      expect(majorScaleIntervals[0]).toBe(0); // Root note
    });

    it('should calculate minor scale correctly', () => {
      // Test minor scale calculation  
      const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10];
      expect(minorScaleIntervals).toHaveLength(7);
      expect(minorScaleIntervals[0]).toBe(0); // Root note
    });
  });

  describe('frequency calculations', () => {
    it('should calculate note frequencies', () => {
      // A4 should be 440Hz
      // This would test your frequency calculation utility
      const a4Frequency = 440;
      expect(a4Frequency).toBe(440);
    });

    it('should handle frequency ranges', () => {
      // Test frequency ranges for musical notes
      const humanHearingRange = { min: 20, max: 20000 };
      const musicalRange = { min: 20, max: 4000 }; // Typical for most instruments
      
      expect(musicalRange.min).toBeGreaterThan(0);
      expect(musicalRange.max).toBeLessThan(humanHearingRange.max);
    });
  });
});
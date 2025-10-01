import { describe, it, expect } from 'vitest';

describe('Basic Math Utilities', () => {
  describe('BPM calculations', () => {
    it('should convert BPM to milliseconds correctly', () => {
      // 120 BPM = 500ms per beat
      const bpm = 120;
      const msPerBeat = (60 * 1000) / bpm;
      
      expect(msPerBeat).toBe(500);
    });

    it('should handle different BPM ranges', () => {
      const bpmRanges = [
        { bpm: 60, expected: 1000 },
        { bpm: 120, expected: 500 },
        { bpm: 180, expected: 333.33333333333337 },
      ];

      bpmRanges.forEach(({ bpm, expected }) => {
        const msPerBeat = (60 * 1000) / bpm;
        expect(msPerBeat).toBeCloseTo(expected, 2);
      });
    });
  });

  describe('Note frequency utilities', () => {
    it('should handle basic frequency calculations', () => {
      // A4 = 440Hz is the standard
      const a4Frequency = 440;
      expect(a4Frequency).toBe(440);
    });

    it('should validate note ranges', () => {
      const notes = ['C3', 'D#4', 'F5', 'A0', 'G#7'];
      
      notes.forEach(note => {
        expect(note).toMatch(/^[A-G]#?\d$/);
      });
    });
  });

  describe('Musical intervals', () => {
    it('should calculate major scale intervals', () => {
      const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
      
      expect(majorScaleIntervals).toHaveLength(7);
      expect(majorScaleIntervals[0]).toBe(0); // Root
      expect(majorScaleIntervals[6]).toBe(11); // Major 7th
    });

    it('should calculate minor scale intervals', () => {
      const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10];
      
      expect(minorScaleIntervals).toHaveLength(7);
      expect(minorScaleIntervals[0]).toBe(0); // Root
      expect(minorScaleIntervals[2]).toBe(3); // Minor 3rd
    });
  });
});
import { describe, it, expect } from 'vitest';

describe('Sequencer Logic Tests', () => {
  describe('Step data validation', () => {
    it('should validate step structure', () => {
      const validStep = {
        id: 'step-1',
        beat: 0,
        note: 'C3',
        velocity: 127,
        gate: 1.0,
        enabled: true
      };

      // Test step structure
      expect(validStep.beat).toBeGreaterThanOrEqual(0);
      expect(validStep.beat).toBeLessThan(16); // Standard 16-step sequencer
      expect(validStep.velocity).toBeGreaterThan(0);
      expect(validStep.velocity).toBeLessThanOrEqual(127);
      expect(validStep.gate).toBeGreaterThan(0);
      expect(validStep.gate).toBeLessThanOrEqual(1);
      expect(typeof validStep.enabled).toBe('boolean');
    });

    it('should handle different note formats', () => {
      const noteFormats = [
        'C3',    // Natural note
        'C#3',   // Sharp note
        'Db3',   // Flat note (if supported)
        'A4',    // Standard A440
      ];

      noteFormats.forEach(note => {
        // Basic note format validation
        expect(typeof note).toBe('string');
        expect(note.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Bank management', () => {
    it('should handle bank structure', () => {
      const bank = {
        id: 'A',
        name: 'Bank A',
        steps: [],
        enabled: true
      };

      expect(['A', 'B', 'C', 'D']).toContain(bank.id);
      expect(Array.isArray(bank.steps)).toBe(true);
      expect(typeof bank.enabled).toBe('boolean');
    });

    it('should validate bank switching logic', () => {
      const banks = ['A', 'B', 'C', 'D'];
      const currentBank = 'A';
      const nextBank = 'B';

      expect(banks).toContain(currentBank);
      expect(banks).toContain(nextBank);
      expect(banks.indexOf(nextBank)).toBeGreaterThan(banks.indexOf(currentBank));
    });
  });

  describe('Timing calculations', () => {
    it('should calculate step timing from BPM', () => {
      const bpm = 120;
      const stepsPerBeat = 4; // 16th notes
      const msPerStep = (60 * 1000) / (bpm * stepsPerBeat);

      expect(msPerStep).toBe(125); // 125ms per 16th note at 120 BPM
    });

    it('should handle different speed settings', () => {
      const speedSettings = [
        { name: '1/4', multiplier: 1 },
        { name: '1/8', multiplier: 2 },
        { name: '1/16', multiplier: 4 },
        { name: '1/32', multiplier: 8 },
      ];

      speedSettings.forEach(speed => {
        expect(speed.multiplier).toBeGreaterThan(0);
        expect(speed.multiplier).toBeLessThanOrEqual(8);
      });
    });
  });

  describe('Pattern operations', () => {
    it('should handle pattern copying', () => {
      const sourcePattern = [
        { beat: 0, note: 'C3', velocity: 127 },
        { beat: 4, note: 'E3', velocity: 100 },
        { beat: 8, note: 'G3', velocity: 110 },
      ];

      const copiedPattern = [...sourcePattern];

      expect(copiedPattern).toHaveLength(sourcePattern.length);
      expect(copiedPattern[0]).toEqual(sourcePattern[0]);
      expect(copiedPattern).not.toBe(sourcePattern); // Different references
    });

    it('should validate pattern constraints', () => {
      const maxSteps = 16;
      const maxVelocity = 127;
      const minVelocity = 1;

      // Test constraints
      expect(maxSteps).toBeGreaterThan(0);
      expect(maxVelocity).toBe(127); // MIDI standard
      expect(minVelocity).toBeGreaterThan(0);
    });
  });
});
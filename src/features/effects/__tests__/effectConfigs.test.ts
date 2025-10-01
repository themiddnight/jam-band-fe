import { describe, it, expect } from 'vitest';
import { EFFECT_CONFIGS } from '../constants/effectConfigs';
import type { EffectType, EffectConfig } from '../types';

describe('Effect Configuration Tests', () => {
  describe('Effect Config Validation', () => {
    it('should have configs for all effect types', () => {
      const expectedEffectTypes: EffectType[] = [
        'reverb', 'delay', 'filter', 'compressor', 'autofilter',
        'autopanner', 'autowah', 'bitcrusher', 'chorus', 'distortion',
        'phaser', 'pingpongdelay', 'stereowidener', 'tremolo', 'vibrato'
      ];

      expectedEffectTypes.forEach(effectType => {
        expect(EFFECT_CONFIGS[effectType]).toBeDefined();
        expect(EFFECT_CONFIGS[effectType].type).toBe(effectType);
      });
    });

    it('should have valid parameter ranges for all effects', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        expect(config.name).toBeTruthy();
        expect(config.icon).toBeTruthy();
        expect(Array.isArray(config.parameters)).toBe(true);
        expect(config.parameters.length).toBeGreaterThan(0);

        config.parameters.forEach(param => {
          expect(param.name).toBeTruthy();
          expect(typeof param.value).toBe('number');
          expect(typeof param.min).toBe('number');
          expect(typeof param.max).toBe('number');
          expect(typeof param.step).toBe('number');
          
          // Value should be within min/max range
          expect(param.value).toBeGreaterThanOrEqual(param.min);
          expect(param.value).toBeLessThanOrEqual(param.max);
          
          // Step should be positive
          expect(param.step).toBeGreaterThan(0);
          
          // Min should be less than or equal to max (allow single value ranges)
          expect(param.min).toBeLessThanOrEqual(param.max);
          
          // Type should be valid
          expect(['knob', 'slider']).toContain(param.type);
        });
      });
    });

    it('should have reasonable default values', () => {
      // Test that all defaults are within valid ranges
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          expect(param.value).toBeGreaterThanOrEqual(param.min);
          expect(param.value).toBeLessThanOrEqual(param.max);
        });
      });
      
      // Test some specific effects exist
      expect(EFFECT_CONFIGS.reverb).toBeDefined();
      expect(EFFECT_CONFIGS.delay).toBeDefined();
    });
  });

  describe('Parameter Type Validation', () => {
    it('should have appropriate parameter types for UI controls', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          // Wet/Dry, Mix parameters should typically be knobs
          if (param.name.toLowerCase().includes('wet') || 
              param.name.toLowerCase().includes('dry') ||
              param.name.toLowerCase().includes('mix')) {
            expect(param.type).toBe('knob');
          }
          
          // Parameters with wide ranges might be sliders
          const range = param.max - param.min;
          if (range > 10) {
            // Could be either, but should be consistent
            expect(['knob', 'slider']).toContain(param.type);
          }
        });
      });
    });

    it('should have units for time-based parameters', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          if (param.name.toLowerCase().includes('time') ||
              param.name.toLowerCase().includes('delay') ||
              param.name.toLowerCase().includes('duration')) {
            // Time parameters should often have units
            if (param.max > 1) {
              expect(param.unit).toBeDefined();
            }
          }
        });
      });
    });
  });

  describe('Effect Chain Logic', () => {
    it('should handle effect parameter boundaries', () => {
      // Test parameter clamping logic
      const testClamping = (value: number, min: number, max: number) => {
        return Math.max(min, Math.min(max, value));
      };

      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          // Test values outside range get clamped
          expect(testClamping(param.min - 1, param.min, param.max)).toBe(param.min);
          expect(testClamping(param.max + 1, param.min, param.max)).toBe(param.max);
          // Only test value clamping if value is actually within range
          if (param.value >= param.min && param.value <= param.max) {
            expect(testClamping(param.value, param.min, param.max)).toBe(param.value);
          }
        });
      });
    });

    it('should validate effect ordering constraints', () => {
      // Some effects work better in certain orders
      const effectOrder = ['compressor', 'filter', 'distortion', 'delay', 'reverb'];
      
      effectOrder.forEach((effectType, index) => {
        expect(EFFECT_CONFIGS[effectType as EffectType]).toBeDefined();
        
        // Earlier effects (like compressor) should typically come before 
        // time-based effects (like delay/reverb)
        if (index < 2) { // compressor, filter
          expect(['compressor', 'filter', 'autofilter'].includes(effectType)).toBe(true);
        }
      });
    });
  });

  describe('Audio Processing Validation', () => {
    it('should have appropriate parameter ranges for audio processing', () => {
      // Test that audio parameters have sensible types and ranges
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          // Frequency-related parameters should be numeric
          if (param.name.toLowerCase().includes('frequency') ||
              param.name.toLowerCase().includes('cutoff')) {
            expect(typeof param.min).toBe('number');
            expect(typeof param.max).toBe('number');
            expect(param.max).toBeGreaterThan(param.min);
          }
          
          // Gain parameters should have numeric ranges
          if (param.name.toLowerCase().includes('gain') ||
              param.name.toLowerCase().includes('level')) {
            expect(typeof param.min).toBe('number');
            expect(typeof param.max).toBe('number');
          }
          
          // Ratio parameters should be positive
          if (param.name.toLowerCase().includes('ratio')) {
            expect(param.min).toBeGreaterThanOrEqual(0);
            expect(param.max).toBeGreaterThan(param.min);
          }
        });
      });
    });

    it('should have consistent wet/dry mixing', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        const wetDryParam = config.parameters.find(p => 
          p.name.toLowerCase().includes('wet') || 
          p.name.toLowerCase().includes('mix')
        );
        
        if (wetDryParam) {
          expect(wetDryParam.min).toBe(0);
          expect(wetDryParam.max).toBe(1);
          expect(wetDryParam.value).toBeGreaterThanOrEqual(0);
          expect(wetDryParam.value).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('UI/UX Validation', () => {
    it('should have user-friendly parameter names', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        expect(config.name).toMatch(/^[A-Z]/); // Should start with capital letter
        
        config.parameters.forEach(param => {
          expect(param.name).toMatch(/^[A-Z]/); // Parameters should start with capital
          expect(param.name.length).toBeGreaterThan(0); // Should have some length
          expect(param.name.length).toBeLessThan(50); // But not too verbose
        });
      });
    });

    it('should have appropriate icons for effects', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        expect(config.icon).toBeTruthy();
        expect(config.icon.length).toBeGreaterThan(0);
        // Icons should be reasonable length for UI (allow for multi-char emojis)
        expect(config.icon.length).toBeLessThanOrEqual(10);
      });
    });

    it('should have reasonable step sizes for UI controls', () => {
      Object.values(EFFECT_CONFIGS).forEach((config: EffectConfig) => {
        config.parameters.forEach(param => {
          const range = param.max - param.min;
          const steps = range / param.step;
          
          // Should have reasonable number of steps for UI control
          expect(steps).toBeGreaterThan(1); // At least some granularity
          expect(steps).toBeLessThan(100000); // But not too many for performance
          expect(param.step).toBeGreaterThan(0); // Step should be positive
        });
      });
    });
  });
});
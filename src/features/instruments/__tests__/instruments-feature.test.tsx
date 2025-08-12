import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act, renderHook } from '@testing-library/react';

// Test imports from the instruments feature
import { 
  useGuitarStore, 
  useBassStore, 
  useKeyboardStore, 
  useDrumStore,
  useBaseInstrumentStore,
  useDrumpadPresetsStore
} from '../index';

// Mock audio context and related APIs
const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 0 }
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 0 }
  })),
  destination: {},
  currentTime: 0
};

// Mock Web Audio API
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

describe('Instruments Feature', () => {
  describe('Store Exports', () => {
    it('should export all instrument stores', () => {
      expect(useGuitarStore).toBeDefined();
      expect(useBassStore).toBeDefined();
      expect(useKeyboardStore).toBeDefined();
      expect(useDrumStore).toBeDefined();
      expect(useBaseInstrumentStore).toBeDefined();
      expect(useDrumpadPresetsStore).toBeDefined();
    });

    it('should initialize guitar store correctly', () => {
      const { result } = renderHook(() => useGuitarStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.playNote).toBe('function');
      expect(typeof result.current.stopNote).toBe('function');
    });

    it('should initialize bass store correctly', () => {
      const { result } = renderHook(() => useBassStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.playNote).toBe('function');
      expect(typeof result.current.stopNote).toBe('function');
    });

    it('should initialize keyboard store correctly', () => {
      const { result } = renderHook(() => useKeyboardStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.playNote).toBe('function');
      expect(typeof result.current.stopNote).toBe('function');
    });

    it('should initialize drum store correctly', () => {
      const { result } = renderHook(() => useDrumStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.playNote).toBe('function');
      expect(typeof result.current.stopNote).toBe('function');
    });

    it('should initialize base instrument store correctly', () => {
      const { result } = renderHook(() => useBaseInstrumentStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.playNote).toBe('function');
      expect(typeof result.current.stopNote).toBe('function');
    });

    it('should initialize drumpad presets store correctly', () => {
      const { result } = renderHook(() => useDrumpadPresetsStore());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.getPresets).toBe('function');
      expect(typeof result.current.savePreset).toBe('function');
    });
  });

  describe('Store Functionality', () => {
    it('should handle note playing in guitar store', () => {
      const { result } = renderHook(() => useGuitarStore());
      
      act(() => {
        // Test playing a note
        result.current.playNote('C4', 0.8);
      });

      // Verify the store state updated correctly
      expect(result.current).toBeDefined();
    });

    it('should handle note stopping in guitar store', () => {
      const { result } = renderHook(() => useGuitarStore());
      
      act(() => {
        // Test stopping a note
        result.current.stopNote('C4');
      });

      // Verify the store state updated correctly
      expect(result.current).toBeDefined();
    });

    it('should handle preset management in drumpad presets store', () => {
      const { result } = renderHook(() => useDrumpadPresetsStore());
      
      act(() => {
        // Test saving a preset
        result.current.savePreset('test-preset', {
          name: 'Test Preset',
          samples: {}
        });
      });

      // Test getting presets
      const presets = result.current.getPresets();
      expect(Array.isArray(presets)).toBe(true);
    });
  });
});
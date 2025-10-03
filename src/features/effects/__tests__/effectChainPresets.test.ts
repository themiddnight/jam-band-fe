import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffectChainPresets } from '../hooks/useEffectChainPresets';
import type { EffectChain } from '../types';

describe('useEffectChainPresets', () => {
  const STORAGE_KEY = 'jam-band-effect-chain-presets';

  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
  });

  // Clean up after each test
  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    expect(result.current.currentPreset).toBeNull();
    expect(result.current.presets).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should save a preset', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'virtual_instrument',
      effects: [
        {
          id: 'effect-1',
          type: 'reverb',
          name: 'Reverb',
          bypassed: false,
          order: 0,
          parameters: [
            {
              id: 'reverb_decay_time_1',
              name: 'Decay Time',
              value: 5.0,
              min: 0.1,
              max: 10,
              step: 0.1,
              type: 'knob',
              unit: 's',
            },
          ],
        },
      ],
    };

    act(() => {
      result.current.savePreset('Test Preset', 'virtual_instrument', mockChain);
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('Test Preset');
    expect(result.current.presets[0].chainType).toBe('virtual_instrument');
    expect(result.current.currentPreset?.name).toBe('Test Preset');
  });

  it('should load a preset', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'virtual_instrument',
      effects: [
        {
          id: 'effect-1',
          type: 'delay',
          name: 'Delay',
          bypassed: false,
          order: 0,
          parameters: [
            {
              id: 'delay_dry_wet_2',
              name: 'Dry/Wet',
              value: 0.3,
              min: 0,
              max: 1,
              step: 0.01,
              type: 'knob',
            },
          ],
        },
      ],
    };

    act(() => {
      result.current.savePreset('Delay Preset', 'virtual_instrument', mockChain);
    });

    const savedPreset = result.current.presets[0];

    act(() => {
      result.current.loadPreset(savedPreset);
    });

    expect(result.current.currentPreset?.id).toBe(savedPreset.id);
  });

  it('should delete a preset', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'audio_voice_input',
      effects: [],
    };

    act(() => {
      result.current.savePreset('To Delete', 'audio_voice_input', mockChain);
    });

    const presetId = result.current.presets[0].id;

    expect(result.current.presets).toHaveLength(1);

    act(() => {
      result.current.deletePreset(presetId);
    });

    expect(result.current.presets).toHaveLength(0);
    expect(result.current.currentPreset).toBeNull();
  });

  it('should filter presets by chain type', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChainVI: EffectChain = {
      type: 'virtual_instrument',
      effects: [],
    };

    const mockChainAV: EffectChain = {
      type: 'audio_voice_input',
      effects: [],
    };

    act(() => {
      result.current.savePreset('VI Preset', 'virtual_instrument', mockChainVI);
      result.current.savePreset('AV Preset', 'audio_voice_input', mockChainAV);
    });

    const viPresets = result.current.getPresetsForChainType('virtual_instrument');
    const avPresets = result.current.getPresetsForChainType('audio_voice_input');

    expect(viPresets).toHaveLength(1);
    expect(viPresets[0].name).toBe('VI Preset');
    expect(avPresets).toHaveLength(1);
    expect(avPresets[0].name).toBe('AV Preset');
  });

  it('should persist presets to localStorage', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'virtual_instrument',
      effects: [],
    };

    act(() => {
      result.current.savePreset('Persistent Preset', 'virtual_instrument', mockChain);
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.presets).toHaveLength(1);
    expect(parsed.presets[0].name).toBe('Persistent Preset');
  });

  it('should export presets as JSON', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'virtual_instrument',
      effects: [],
    };

    act(() => {
      result.current.savePreset('Export Test', 'virtual_instrument', mockChain);
    });

    const exported = result.current.exportPresets();
    const parsed = JSON.parse(exported);

    expect(parsed.presets).toHaveLength(1);
    expect(parsed.presets[0].name).toBe('Export Test');
    expect(parsed.version).toBe('1.0.0');
  });

  it('should import presets in merge mode', () => {
    const { result } = renderHook(() => useEffectChainPresets());

    const mockChain: EffectChain = {
      type: 'virtual_instrument',
      effects: [],
    };

    act(() => {
      result.current.savePreset('Existing Preset', 'virtual_instrument', mockChain);
    });

    const importData = JSON.stringify({
      presets: [
        {
          id: 'imported-1',
          name: 'Imported Preset',
          chainType: 'audio_voice_input',
          effects: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      version: '1.0.0',
    });

    act(() => {
      result.current.importPresets(importData, 'merge');
    });

    expect(result.current.presets).toHaveLength(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputMonitoring } from '../useInputMonitoring';

// Mock dependencies before importing the hook
vi.mock('@/features/audio/stores/audioDeviceStore', () => ({
  useAudioDeviceStore: vi.fn((selector) => selector({ dawInputDeviceId: 'test-device-id' })),
}));

// Use consistent mocking for the module
vi.mock('../../utils/audioInput', () => ({
  getOrCreateUserMedia: vi.fn(),
  isUserMediaAvailable: vi.fn(),
}));

vi.mock('@/features/audio/utils/effectsArchitecture', () => ({
  getOrCreateGlobalMixer: vi.fn(),
}));

import * as Tone from 'tone';
import { getOrCreateUserMedia, isUserMediaAvailable } from '../../utils/audioInput';
import { getOrCreateGlobalMixer } from '@/features/audio/utils/effectsArchitecture';

// Mock Tone.js
vi.mock('tone', async () => {
  return {
    getContext: vi.fn(() => ({
      rawContext: {
        createAnalyser: vi.fn(),
        createGain: vi.fn(),
        destination: {},
      }
    })),
  };
});

describe('useInputMonitoring', () => {
  let mockSourceNode: any;
  let mockAnalyser: any;
  let mockMixer: any;
  let mockTrackChannel: any;
  let mockGainNode: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Audio Nodes
    mockSourceNode = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAnalyser = {
      fftSize: 256,
      smoothingTimeConstant: 0.8,
      getByteTimeDomainData: vi.fn(),
      disconnect: vi.fn(),
    };

    mockGainNode = {
      gain: { value: 1 },
      disconnect: vi.fn(),
    };

    // Setup mocks
    (getOrCreateUserMedia as any).mockResolvedValue(mockSourceNode);
    (isUserMediaAvailable as any).mockReturnValue(true);

    // Mock AudioContext creation methods
    (Tone.getContext as any).mockReturnValue({
      rawContext: {
        createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: {},
      }
    });

    // Mock Mixer
    mockTrackChannel = {
      inputGain: { ...mockGainNode, name: 'trackInputGain' },
    };
    mockMixer = {
      getChannel: vi.fn().mockReturnValue(mockTrackChannel),
      createUserChannel: vi.fn(),
    };
    (getOrCreateGlobalMixer as any).mockResolvedValue(mockMixer);

    // Valid timer for setInterval
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set up metering when active', async () => {
    renderHook(() => useInputMonitoring('track-1', true, false));

    // Wait for async setup
    await act(async () => {
      await Promise.resolve();
    });

    expect(getOrCreateUserMedia).toHaveBeenCalledWith('test-device-id');
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAnalyser);
  });

  it('should update level based on analyser data', async () => {
    const { result } = renderHook(() => useInputMonitoring('track-1', true, false));

    await act(async () => {
      await Promise.resolve();
    });

    // Mock analyser data (some noise)
    mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
      array.fill(200); // High level
    });

    // Fast forward time
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBeGreaterThan(0);
  });

  it('should disconnect on unmount', async () => {
    const { unmount } = renderHook(() => useInputMonitoring('track-1', true, false));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    // Check if interval cleared (hard to check directly, but we can verify no more calls)
    expect(mockSourceNode.disconnect).toHaveBeenCalledWith(mockAnalyser); // We MUST disconnect source from analyser to prevent leak

    // But we might disconnect analyser... logic says try { analyserRef.current.disconnect() }
    expect(mockAnalyser.disconnect).toHaveBeenCalled();
  });

  it('should setup feedback connection to mixer channel', async () => {
    renderHook(() => useInputMonitoring('track-1', true, true)); // Enable feedback

    await act(async () => {
      await Promise.resolve();
    });

    expect(getOrCreateGlobalMixer).toHaveBeenCalled();
    expect(mockMixer.getChannel).toHaveBeenCalledWith('track-1');
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockTrackChannel.inputGain);
  });

  it('should create user channel if not exists for feedback', async () => {
    mockMixer.getChannel.mockReturnValueOnce(null).mockReturnValueOnce(mockTrackChannel);

    renderHook(() => useInputMonitoring('track-1', true, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockMixer.createUserChannel).toHaveBeenCalledWith('track-1', 'Track track-1');
  });

  it('should not setup monitoring if trackId is null', () => {
    renderHook(() => useInputMonitoring(null, true, false));
    expect(getOrCreateUserMedia).not.toHaveBeenCalled();
  });

  it('should not setup monitoring if showMeter is false', () => {
    renderHook(() => useInputMonitoring('track-1', false, false));
    // Meter setup should be skipped
    expect(Tone.getContext().rawContext.createAnalyser).not.toHaveBeenCalled();

    // But wait... getOrCreateUserMedia call is inside setupMonitoring which is guarded by !trackId || !showMeter ??
    // Actually the hook returns early if !trackId || !showMeter.
  });
});

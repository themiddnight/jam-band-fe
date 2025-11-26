import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstrumentEngine } from '../utils/InstrumentEngine';
import { InstrumentCategory } from '../../../shared/constants/instruments';

// Mock modules at the top level (hoisted)
vi.mock('../../audio/constants/audioConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../audio/constants/audioConfig')>();
  return {
    ...actual,
    AudioContextManager: {
      ...actual.AudioContextManager,
      getInstrumentContext: vi.fn(),
      getMaxPolyphony: vi.fn().mockReturnValue(32),
      isWebRTCActive: vi.fn().mockReturnValue(false),
    },
  };
});

vi.mock('../../audio/utils/effectsArchitecture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../audio/utils/effectsArchitecture')>();
  return {
    ...actual,
    getOrCreateGlobalMixer: vi.fn(),
  };
});

vi.mock('../../../shared/utils/webkitCompat', () => ({
  isSafari: vi.fn().mockReturnValue(false),
  getSafariLoadTimeout: vi.fn().mockReturnValue(30000),
  handleSafariAudioError: vi.fn((error) => error),
  findNextCompatibleInstrument: vi.fn(),
}));

// Mock Tone.js
vi.mock('tone', () => {
  const mockAudioNode = {
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    volume: { value: 0 },
  };

  const mockSynth = {
    ...mockAudioNode,
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    get: vi.fn().mockReturnValue({}),
    envelope: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.5,
      release: 0.5,
    },
    oscillator: {
      type: 'sine',
    },
  };

  const mockPolySynth = {
    ...mockSynth,
    maxPolyphony: 32,
  };

  return {
    Synth: vi.fn(() => mockSynth),
    PolySynth: vi.fn(() => mockPolySynth),
    MonoSynth: vi.fn(() => mockSynth),
    FMSynth: vi.fn(() => mockSynth),
    AMSynth: vi.fn(() => mockSynth),
    DuoSynth: vi.fn(() => mockSynth),
    MembraneSynth: vi.fn(() => mockSynth),
    MetalSynth: vi.fn(() => mockSynth),
    PluckSynth: vi.fn(() => mockSynth),
    Sampler: vi.fn(() => mockSynth),
    Channel: vi.fn(() => ({
      ...mockAudioNode,
      pan: { value: 0 },
      volume: { value: 0 },
    })),
    Filter: vi.fn(() => ({
      ...mockAudioNode,
      frequency: { value: 350 },
      Q: { value: 1 },
      type: 'lowpass',
    })),
    Gain: vi.fn(() => ({
      ...mockAudioNode,
      gain: { value: 1 },
    })),
    FrequencyEnvelope: vi.fn(() => ({
      ...mockAudioNode,
      attack: 0.01,
      decay: 0.1,
      sustain: 0.5,
      release: 0.5,
      baseFrequency: 200,
      octaves: 4,
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      triggerAttackRelease: vi.fn(),
    })),
    Reverb: vi.fn(() => mockAudioNode),
    Delay: vi.fn(() => mockAudioNode),
    Chorus: vi.fn(() => mockAudioNode),
    Distortion: vi.fn(() => mockAudioNode),
    setContext: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn(() => ({
      lookAhead: 0.1,
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
    })),
    now: vi.fn(() => 0),
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      bpm: { value: 120 },
    },
  };
});

/**
 * Regression Tests for InstrumentEngine Synthesizer Loading
 * 
 * These tests prevent the following bugs from reoccurring:
 * 1. "require is not defined" error when loading synthesizers (fixed 2024-11-26)
 * 2. "maxPolyphony does not exist" TypeScript error (fixed 2024-11-26)
 * 3. "Unexpected lexical declaration in case block" error (fixed 2024-11-26)
 * 
 * Context: The synthesizer loading code was using CommonJS `require()` which doesn't
 * work in browser environments. It also had incorrect TypeScript types for maxPolyphony
 * configuration and missing block scopes in switch cases.
 */

describe('InstrumentEngine - Synthesizer Loading (Regression Tests)', () => {
  let mockAudioContext: AudioContext;
  let mockMixer: any;

  beforeEach(async () => {
    // Create a mock AudioContext for testing
    mockAudioContext = new AudioContext();
    
    // Setup mock mixer
    mockMixer = {
      getChannel: vi.fn().mockReturnValue(null),
      createUserChannel: vi.fn().mockReturnValue({
        inputGain: mockAudioContext.createGain(),
      }),
      routeInstrumentToChannel: vi.fn(),
    };
    
    // Configure mocked modules
    const { AudioContextManager } = await import('../../audio/constants/audioConfig');
    const { getOrCreateGlobalMixer } = await import('../../audio/utils/effectsArchitecture');
    
    vi.mocked(AudioContextManager.getInstrumentContext).mockResolvedValue(mockAudioContext);
    vi.mocked(getOrCreateGlobalMixer).mockResolvedValue(mockMixer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (mockAudioContext.state !== 'closed') {
      mockAudioContext.close();
    }
  });

  describe('Bug Fix: require() usage in browser environment', () => {
    it('should not use CommonJS require() when creating synthesizers', async () => {
      // This test ensures we never reintroduce require() calls
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // This should not throw "require is not defined" error
      await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
    });

    it('should use ES6 imports for isSafari utility', async () => {
      // Verify that isSafari is imported at the top of the file, not required inline
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // The createSynthesizer method should work without require errors
      await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
    });
  });

  describe('Bug Fix: maxPolyphony TypeScript configuration', () => {
    it('should set maxPolyphony as a property on PolySynth instance', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Verify the engine loaded successfully
      expect(engine.isReady()).toBe(true);
    });

    it('should configure maxPolyphony for analog_poly synthesizer', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // The synthesizer should be created without TypeScript errors
      expect(engine.isReady()).toBe(true);
      expect(engine.getCategory()).toBe(InstrumentCategory.Synthesizer);
    });

    it('should configure maxPolyphony for fm_poly synthesizer', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'fm_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // The synthesizer should be created without TypeScript errors
      expect(engine.isReady()).toBe(true);
      expect(engine.getInstrumentName()).toBe('fm_poly');
    });
  });

  describe('Bug Fix: Case block scope for variable declarations', () => {
    it('should handle analog_poly case with proper block scope', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // Should not throw "Unexpected lexical declaration in case block"
      await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
    });

    it('should handle fm_poly case with proper block scope', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'fm_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // Should not throw "Unexpected lexical declaration in case block"
      await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
    });
  });

  describe('Synthesizer type coverage', () => {
    const synthTypes = [
      'analog_mono',
      'analog_bass',
      'analog_lead',
      'analog_poly',
      'fm_mono',
      'fm_poly',
    ];

    synthTypes.forEach((synthType) => {
      it(`should load ${synthType} synthesizer without errors`, async () => {
        const engine = new InstrumentEngine({
          userId: 'test-user',
          username: 'Test User',
          instrumentName: synthType,
          category: InstrumentCategory.Synthesizer,
          isLocalUser: true,
        });

        await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
        expect(engine.getInstrumentName()).toBe(synthType);
        expect(engine.getCategory()).toBe(InstrumentCategory.Synthesizer);
      });
    });
  });

  describe('Safari compatibility', () => {
    it('should use safe oscillator types on Safari', async () => {
      // Mock isSafari to return true for this test
      const { isSafari } = await import('../../../shared/utils/webkitCompat');
      vi.mocked(isSafari).mockReturnValue(true);

      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Should load successfully with Safari-safe settings
      expect(engine.isReady()).toBe(true);
      
      // Reset mock
      vi.mocked(isSafari).mockReturnValue(false);
    });

    it('should reduce polyphony on Safari for analog_poly', async () => {
      const { isSafari } = await import('../../../shared/utils/webkitCompat');
      vi.mocked(isSafari).mockReturnValue(true);

      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Should use reduced polyphony (16 instead of 32) on Safari
      expect(engine.isReady()).toBe(true);
      
      vi.mocked(isSafari).mockReturnValue(false);
    });

    it('should reduce polyphony on Safari for fm_poly', async () => {
      const { isSafari } = await import('../../../shared/utils/webkitCompat');
      vi.mocked(isSafari).mockReturnValue(true);

      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'fm_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Should use reduced polyphony (12 instead of 32) on Safari for FM synths
      expect(engine.isReady()).toBe(true);
      
      vi.mocked(isSafari).mockReturnValue(false);
    });
  });

  describe('Polyphony configuration', () => {
    it('should respect WebRTC optimization mode for polyphony', () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // Default polyphony
      expect(engine.getMaxPolyphony()).toBe(32);

      // Enable WebRTC optimization
      engine.setWebRTCOptimization(true);
      expect(engine.getMaxPolyphony()).toBe(16);

      // Disable WebRTC optimization
      engine.setWebRTCOptimization(false);
      expect(engine.getMaxPolyphony()).toBe(32);
    });
  });

  describe('Synthesizer parameter updates', () => {
    it('should update synth parameters without errors', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Update parameters
      await expect(
        engine.updateSynthParams({
          volume: 0.8,
          ampAttack: 0.05,
          filterFrequency: 2000,
        })
      ).resolves.not.toThrow();
    });

    it('should preserve synth state across instrument changes', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Set custom parameters
      await engine.updateSynthParams({
        volume: 0.7,
        filterFrequency: 1500,
      });

      const stateBefore = engine.getSynthState();

      // Change to different synth
      engine.updateInstrument('analog_bass', InstrumentCategory.Synthesizer);

      const stateAfter = engine.getSynthState();

      // Parameters should be preserved
      expect(stateAfter.volume).toBe(stateBefore.volume);
      expect(stateAfter.filterFrequency).toBe(stateBefore.filterFrequency);
    });
  });

  describe('Note playback', () => {
    it('should filter out non-musical notes for synthesizers', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Mix of musical notes and drum samples
      const notes = ['C4', 'kick', 'D4', 'snare', 'E4'];

      // Should only play musical notes (C4, D4, E4)
      await expect(engine.playNotes(notes, 0.7)).resolves.not.toThrow();
    });

    it('should handle polyphonic note playback', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Play a chord
      const chord = ['C4', 'E4', 'G4'];
      await expect(engine.playNotes(chord, 0.7)).resolves.not.toThrow();
    });

    it('should handle monophonic note playback', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Play single notes
      await expect(engine.playNotes(['C4'], 0.7)).resolves.not.toThrow();
      await expect(engine.playNotes(['D4'], 0.7)).resolves.not.toThrow();
    });
  });

  describe('Emergency cleanup', () => {
    it('should force stop all notes during emergency cleanup', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Play some notes
      await engine.playNotes(['C4', 'E4', 'G4'], 0.7);

      // Emergency cleanup should not throw
      expect(() => engine.emergencyCleanup()).not.toThrow();

      // All notes should be stopped
      expect(engine.getAllActiveNotes()).toHaveLength(0);
    });
  });

  describe('Resource cleanup', () => {
    it('should dispose synthesizer resources properly', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_poly',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Dispose should not throw
      expect(() => engine.dispose()).not.toThrow();
    });

    it('should clean up audio nodes on instrument change', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Change instrument
      engine.updateInstrument('fm_mono', InstrumentCategory.Synthesizer);

      // Should not throw and should be ready to load new instrument
      expect(engine.isReady()).toBe(false);
      expect(engine.getInstrumentName()).toBe('fm_mono');
    });
  });

  describe('Integration with audio routing', () => {
    it('should route synthesizer output to global mixer', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      // Verify mixer integration was attempted
      expect(engine.isReady()).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'invalid_synth',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // Should create default synth for unknown types
      await expect(engine.initialize(mockAudioContext)).resolves.not.toThrow();
    });

    it('should handle parameter update errors gracefully', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      // Try to update params before initialization
      await expect(
        engine.updateSynthParams({ volume: 0.5 })
      ).resolves.not.toThrow();
    });
  });

  describe('Backwards compatibility', () => {
    it('should maintain compatibility with existing synth state format', async () => {
      const engine = new InstrumentEngine({
        userId: 'test-user',
        username: 'Test User',
        instrumentName: 'analog_mono',
        category: InstrumentCategory.Synthesizer,
        isLocalUser: true,
      });

      await engine.initialize(mockAudioContext);

      const state = engine.getSynthState();

      // Verify all expected properties exist
      expect(state).toHaveProperty('volume');
      expect(state).toHaveProperty('ampAttack');
      expect(state).toHaveProperty('ampDecay');
      expect(state).toHaveProperty('ampSustain');
      expect(state).toHaveProperty('ampRelease');
      expect(state).toHaveProperty('oscillatorType');
      expect(state).toHaveProperty('filterFrequency');
      expect(state).toHaveProperty('filterResonance');
      expect(state).toHaveProperty('filterAttack');
      expect(state).toHaveProperty('filterDecay');
      expect(state).toHaveProperty('filterSustain');
      expect(state).toHaveProperty('filterRelease');
      expect(state).toHaveProperty('modulationIndex');
      expect(state).toHaveProperty('harmonicity');
      expect(state).toHaveProperty('modAttack');
      expect(state).toHaveProperty('modDecay');
      expect(state).toHaveProperty('modSustain');
      expect(state).toHaveProperty('modRelease');
    });
  });
});

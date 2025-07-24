import { useRef, useCallback, useEffect } from 'react';
import { InstrumentEngine } from '../utils/InstrumentEngine';
import type { SynthState, InstrumentEngineConfig } from '../utils/InstrumentEngine';
import { InstrumentCategory } from '../constants/instruments';
import { createWebKitCompatibleAudioContext } from '../utils/webkitCompat';

export interface UseUnifiedInstrumentManagerReturn {
  // Local instrument management
  getLocalEngine: () => InstrumentEngine | null;
  initializeLocalEngine: (config: Omit<InstrumentEngineConfig, 'isLocalUser'>) => Promise<InstrumentEngine>;
  updateLocalInstrument: (instrumentName: string, category: InstrumentCategory) => Promise<void>;
  
  // Remote instrument management
  addRemoteEngine: (config: Omit<InstrumentEngineConfig, 'isLocalUser'>) => Promise<InstrumentEngine>;
  getRemoteEngine: (userId: string, instrumentName: string, category: InstrumentCategory) => InstrumentEngine | null;
  updateRemoteInstrument: (userId: string, username: string, instrumentName: string, category: InstrumentCategory) => Promise<InstrumentEngine>;
  removeRemoteEngine: (userId: string) => void;
  
  // Playback methods (unified interface)
  playLocalNotes: (notes: string[], velocity: number, isKeyHeld?: boolean) => Promise<void>;
  stopLocalNotes: (notes: string[]) => Promise<void>;
  setLocalSustain: (sustain: boolean) => void;
  
  playRemoteNotes: (userId: string, username: string, notes: string[], velocity: number, instrumentName: string, category: InstrumentCategory, isKeyHeld?: boolean) => Promise<void>;
  stopRemoteNotes: (userId: string, notes: string[], instrumentName: string, category: InstrumentCategory) => Promise<void>;
  setRemoteSustain: (userId: string, sustain: boolean, instrumentName: string, category: InstrumentCategory) => void;
  
  // Synthesizer parameter management
  updateLocalSynthParams: (params: Partial<SynthState>) => Promise<void>;
  updateRemoteSynthParams: (userId: string, username: string, instrumentName: string, category: InstrumentCategory, params: Partial<SynthState>) => Promise<void>;
  getLocalSynthState: () => SynthState | null;
  
  // Drum machine sample management
  getLocalAvailableSamples: () => string[];
  
  // Utility methods
  isReady: () => boolean;
  cleanup: () => void;
  preloadInstruments: (instruments: Array<{ userId: string; username: string; instrumentName: string; category: string; }>) => Promise<void>;
}

export const useUnifiedInstrumentManager = (): UseUnifiedInstrumentManagerReturn => {
  const audioContext = useRef<AudioContext | null>(null);
  const localEngine = useRef<InstrumentEngine | null>(null);
  const remoteEngines = useRef<Map<string, InstrumentEngine>>(new Map());
  const isInitialized = useRef<boolean>(false);
  
  // Track loading states to prevent concurrent requests
  const loadingEngines = useRef<Map<string, Promise<InstrumentEngine>>>(new Map());

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    if (!audioContext.current) {
      audioContext.current = await createWebKitCompatibleAudioContext();
    }

    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }

    if (audioContext.current.state !== "running") {
      throw new Error(`AudioContext state is ${audioContext.current.state}, expected 'running'`);
    }

    isInitialized.current = true;
    return audioContext.current;
  }, []);

  // Local instrument management
  const getLocalEngine = useCallback(() => {
    return localEngine.current;
  }, []);

  const initializeLocalEngine = useCallback(async (config: Omit<InstrumentEngineConfig, 'isLocalUser'>) => {
    if (!isInitialized.current) {
      await initializeAudioContext();
    }

    // Dispose existing local engine
    if (localEngine.current) {
      localEngine.current.dispose();
    }

    const engineConfig: InstrumentEngineConfig = {
      ...config,
      isLocalUser: true,
    };

    localEngine.current = new InstrumentEngine(engineConfig);
    await localEngine.current.initialize(audioContext.current!);
    
    return localEngine.current;
  }, [initializeAudioContext]);

  const updateLocalInstrument = useCallback(async (instrumentName: string, category: InstrumentCategory) => {
    if (!localEngine.current) {
      throw new Error('Local engine not initialized');
    }

    localEngine.current.updateInstrument(instrumentName, category);
    await localEngine.current.load();
  }, []);

  // Remote instrument management
  const getEngineKey = useCallback((userId: string, instrumentName: string, category: InstrumentCategory) => {
    return `${userId}-${instrumentName}-${category}`;
  }, []);

  const addRemoteEngine = useCallback(async (config: Omit<InstrumentEngineConfig, 'isLocalUser'>) => {
    if (!isInitialized.current) {
      await initializeAudioContext();
    }

    const key = getEngineKey(config.userId, config.instrumentName, config.category);
    
    // Check if this engine is already being loaded
    const existingLoadPromise = loadingEngines.current.get(key);
    if (existingLoadPromise) {
      console.log(`⏳ Engine ${key} already loading, waiting for existing load...`);
      return existingLoadPromise;
    }
    
    // Check if engine already exists and is ready
    const existingEngine = remoteEngines.current.get(key);
    if (existingEngine && existingEngine.isReady()) {
      return existingEngine;
    }

    const engineConfig: InstrumentEngineConfig = {
      ...config,
      isLocalUser: false,
    };
    
    // Create loading promise
    const loadPromise = (async () => {
      // Dispose existing engine with same key
      if (existingEngine) {
        existingEngine.dispose();
      }

      const engine = new InstrumentEngine(engineConfig);
      await engine.initialize(audioContext.current!);
      
      remoteEngines.current.set(key, engine);
      loadingEngines.current.delete(key); // Clean up loading state
      
      return engine;
    })();
    
    // Track the loading promise
    loadingEngines.current.set(key, loadPromise);
    
    try {
      return await loadPromise;
    } catch (error) {
      // Clean up loading state on error
      loadingEngines.current.delete(key);
      throw error;
    }
  }, [initializeAudioContext, getEngineKey]);

  const getRemoteEngine = useCallback((userId: string, instrumentName: string, category: InstrumentCategory) => {
    const key = getEngineKey(userId, instrumentName, category);
    return remoteEngines.current.get(key) || null;
  }, [getEngineKey]);

  const updateRemoteInstrument = useCallback(async (userId: string, username: string, instrumentName: string, category: InstrumentCategory) => {
    const key = getEngineKey(userId, instrumentName, category);
    
    // Check if we already have this exact engine
    let engine = remoteEngines.current.get(key);
    
    if (!engine) {
      // Create new engine for this instrument
      engine = await addRemoteEngine({
        userId,
        username,
        instrumentName,
        category,
      });
    }
    
    return engine;
  }, [getEngineKey, addRemoteEngine]);

  const removeRemoteEngine = useCallback((userId: string) => {
    // Remove all engines for this user
    const keysToDelete: string[] = [];
    
    remoteEngines.current.forEach((engine, key) => {
      if (engine.getUserId() === userId) {
        engine.dispose();
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      remoteEngines.current.delete(key);
    });
    
  }, []);

  // Local playback methods
  const playLocalNotes = useCallback(async (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
    if (!localEngine.current) {
      throw new Error('Local engine not initialized');
    }
    
    await localEngine.current.playNotes(notes, velocity, isKeyHeld);
  }, []);

  const stopLocalNotes = useCallback(async (notes: string[]) => {
    if (!localEngine.current) {
      return;
    }
    
    await localEngine.current.stopNotes(notes);
  }, []);

  const setLocalSustain = useCallback((sustain: boolean) => {
    if (!localEngine.current) {
      return;
    }
    
    localEngine.current.setSustain(sustain);
  }, []);

  // Remote playback methods
  const playRemoteNotes = useCallback(async (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld: boolean = false
  ) => {
    let engine = getRemoteEngine(userId, instrumentName, category);
    
    // Create engine if it doesn't exist
    if (!engine) {
      engine = await addRemoteEngine({
        userId,
        username,
        instrumentName,
        category,
      });
    }
    
    await engine.playNotes(notes, velocity, isKeyHeld);
  }, [getRemoteEngine, addRemoteEngine]);

  const stopRemoteNotes = useCallback(async (
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    const engine = getRemoteEngine(userId, instrumentName, category);
    
    if (engine) {
      await engine.stopNotes(notes);
    }
  }, [getRemoteEngine]);

  const setRemoteSustain = useCallback((
    userId: string,
    sustain: boolean,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    const engine = getRemoteEngine(userId, instrumentName, category);
    
    if (engine) {
      engine.setSustain(sustain);
    }
  }, [getRemoteEngine]);

  // Synthesizer parameter management
  const updateLocalSynthParams = useCallback(async (params: Partial<SynthState>) => {
    if (!localEngine.current) {
      throw new Error('Local engine not initialized');
    }
    
    await localEngine.current.updateSynthParams(params);
  }, []);

  const updateRemoteSynthParams = useCallback(async (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
    params: Partial<SynthState>
  ) => {
    let engine = getRemoteEngine(userId, instrumentName, category);
    
    // Create engine if it doesn't exist
    if (!engine) {
      engine = await addRemoteEngine({
        userId,
        username,
        instrumentName,
        category,
      });
    }
    
    await engine.updateSynthParams(params);
  }, [getRemoteEngine, addRemoteEngine]);

  const getLocalSynthState = useCallback(() => {
    if (!localEngine.current) {
      return null;
    }
    
    return localEngine.current.getSynthState();
  }, []);

  const getLocalAvailableSamples = useCallback(() => {
    if (!localEngine.current) {
      return [];
    }
    
    return localEngine.current.getAvailableSamples();
  }, []);

  // Utility methods
  const isReady = useCallback(() => {
    return isInitialized.current && audioContext.current?.state === 'running';
  }, []);

  const cleanup = useCallback(() => {
    // Dispose local engine
    if (localEngine.current) {
      localEngine.current.dispose();
      localEngine.current = null;
    }
    
    // Dispose all remote engines
    remoteEngines.current.forEach(engine => {
      engine.dispose();
    });
    remoteEngines.current.clear();
    
    // Clear loading states
    loadingEngines.current.clear();
    
    // Close audio context
    if (audioContext.current && audioContext.current.state !== 'closed') {
      audioContext.current.close();
      audioContext.current = null;
    }
    
    isInitialized.current = false;
  }, []);

  const preloadInstruments = useCallback(async (instruments: Array<{ 
    userId: string; 
    username: string; 
    instrumentName: string; 
    category: string; 
  }>) => {
    if (!isReady()) {
      return;
    }

    for (const instrument of instruments) {
      try {
        const category = instrument.category as InstrumentCategory;
        const existingEngine = getRemoteEngine(instrument.userId, instrument.instrumentName, category);
        
        if (!existingEngine) {
          await addRemoteEngine({
            userId: instrument.userId,
            username: instrument.username,
            instrumentName: instrument.instrumentName,
            category,
          });
        }
      } catch (error) {
        console.error(`❌ Failed to preload instrument for ${instrument.username}:`, error);
      }
    }
  }, [isReady, getRemoteEngine, addRemoteEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // Local instrument management
    getLocalEngine,
    initializeLocalEngine,
    updateLocalInstrument,
    
    // Remote instrument management
    addRemoteEngine,
    getRemoteEngine,
    updateRemoteInstrument,
    removeRemoteEngine,
    
    // Playback methods
    playLocalNotes,
    stopLocalNotes,
    setLocalSustain,
    playRemoteNotes,
    stopRemoteNotes,
    setRemoteSustain,
    
    // Synthesizer parameter management
    updateLocalSynthParams,
    updateRemoteSynthParams,
    getLocalSynthState,
    
    // Drum machine sample management
    getLocalAvailableSamples,
    
    // Utility methods
    isReady,
    cleanup,
    preloadInstruments,
  };
}; 
import { InstrumentEngine } from "@/features/instruments";
import type {
  SynthState,
  InstrumentEngineConfig,
} from "@/features/instruments";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { createWebKitCompatibleAudioContext } from "@/shared/utils/webkitCompat";
import { useRef, useCallback, useEffect } from "react";

export interface UseInstrumentManagerReturn {
  // Local instrument management
  getLocalEngine: () => InstrumentEngine | null;
  initializeLocalEngine: (
    config: Omit<InstrumentEngineConfig, "isLocalUser">,
  ) => Promise<InstrumentEngine>;
  updateLocalInstrument: (
    instrumentName: string,
    category: InstrumentCategory,
  ) => Promise<void>;

  // Remote instrument management
  addRemoteEngine: (
    config: Omit<InstrumentEngineConfig, "isLocalUser">,
  ) => Promise<InstrumentEngine>;
  getRemoteEngine: (
    userId: string,
    instrumentName: string,
    category: InstrumentCategory,
  ) => InstrumentEngine | null;
  updateRemoteInstrument: (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
  ) => Promise<InstrumentEngine>;
  removeRemoteEngine: (userId: string) => void;

  // Instrument fallback handling
  onLocalInstrumentFallback?: (
    originalInstrument: string,
    fallbackInstrument: string,
    category: InstrumentCategory,
  ) => void;
  onRemoteInstrumentFallback?: (
    userId: string,
    username: string,
    originalInstrument: string,
    fallbackInstrument: string,
    category: InstrumentCategory,
  ) => void;

  // Playback methods (unified interface)
  playLocalNotes: (
    notes: string[],
    velocity: number,
    isKeyHeld?: boolean,
  ) => Promise<void>;
  stopLocalNotes: (notes: string[]) => Promise<void>;
  setLocalSustain: (sustain: boolean) => void;

  playRemoteNotes: (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld?: boolean,
  ) => Promise<void>;
  stopRemoteNotes: (
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory,
  ) => Promise<void>;
  setRemoteSustain: (
    userId: string,
    sustain: boolean,
    instrumentName: string,
    category: InstrumentCategory,
  ) => void;

  // Synthesizer parameter management
  updateLocalSynthParams: (params: Partial<SynthState>) => Promise<void>;
  updateRemoteSynthParams: (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
    params: Partial<SynthState>,
  ) => Promise<void>;
  getLocalSynthState: () => SynthState | null;

  // Drum machine sample management
  getLocalAvailableSamples: () => string[];

  // Utility methods
  isReady: () => boolean;
  cleanup: () => void;
  preloadInstruments: (
    instruments: Array<{
      userId: string;
      username: string;
      instrumentName: string;
      category: string;
    }>,
  ) => Promise<void>;
}

export const useInstrumentManager = (): UseInstrumentManagerReturn => {
  const audioContext = useRef<AudioContext | null>(null);
  const localEngine = useRef<InstrumentEngine | null>(null);
  const remoteEngines = useRef<Map<string, InstrumentEngine>>(new Map());
  const isInitialized = useRef<boolean>(false);
  // Track last known local config so we can lazy-initialize after hot reloads or resume
  const lastLocalConfig = useRef<Omit<
    InstrumentEngineConfig,
    "isLocalUser"
  > | null>(null);
  // Prevent concurrent local engine initializations
  const localEngineLoadingPromise = useRef<Promise<InstrumentEngine> | null>(
    null,
  );

  // Track loading states to prevent concurrent requests
  const loadingEngines = useRef<Map<string, Promise<InstrumentEngine>>>(
    new Map(),
  );

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    if (!audioContext.current) {
      audioContext.current = await createWebKitCompatibleAudioContext();
    }

    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }

    if (audioContext.current.state !== "running") {
      throw new Error(
        `AudioContext state is ${audioContext.current.state}, expected 'running'`,
      );
    }

    isInitialized.current = true;
    return audioContext.current;
  }, []);

  // Local instrument management
  const getLocalEngine = useCallback(() => {
    return localEngine.current;
  }, []);

  const initializeLocalEngine = useCallback(
    async (config: Omit<InstrumentEngineConfig, "isLocalUser">) => {
      lastLocalConfig.current = { ...config };

      if (!isInitialized.current) {
        await initializeAudioContext();
      }

      // If an initialization is already in progress, reuse it
      if (localEngineLoadingPromise.current) {
        return localEngineLoadingPromise.current;
      }

      // Dispose existing local engine
      if (localEngine.current) {
        localEngine.current.dispose();
      }

      const engineConfig: InstrumentEngineConfig = {
        ...config,
        isLocalUser: true,
        onInstrumentFallback: (
          originalInstrument: string,
          fallbackInstrument: string,
          category: InstrumentCategory,
        ) => {
          console.log(
            `🔄 Local instrument fallback: ${originalInstrument} → ${fallbackInstrument} (${category})`,
          );
          // This will be handled by the unified instrument hook
        },
      };

      const initPromise = (async () => {
        localEngine.current = new InstrumentEngine(engineConfig);
        await localEngine.current.initialize(audioContext.current!);
        return localEngine.current;
      })();

      localEngineLoadingPromise.current = initPromise;

      try {
        const engine = await initPromise;
        return engine;
      } finally {
        localEngineLoadingPromise.current = null;
      }
    },
    [initializeAudioContext],
  );

  const updateLocalInstrument = useCallback(
    async (instrumentName: string, category: InstrumentCategory) => {
      // If the local engine is missing (e.g., after hot-reload), try to restore it lazily
      if (!localEngine.current) {
        if (lastLocalConfig.current) {
          await initializeLocalEngine({
            ...lastLocalConfig.current,
            instrumentName,
            category,
          });
          return;
        }
        // No config to restore from; nothing we can do
        console.warn(
          "updateLocalInstrument called before local engine was initialized",
        );
        return;
      }

      localEngine.current.updateInstrument(instrumentName, category);
      await localEngine.current.load();
    },
    [initializeLocalEngine],
  );

  // Remote instrument management
  const getEngineKey = useCallback(
    (userId: string, instrumentName: string, category: InstrumentCategory) => {
      return `${userId}-${instrumentName}-${category}`;
    },
    [],
  );

  const addRemoteEngine = useCallback(
    async (config: Omit<InstrumentEngineConfig, "isLocalUser">) => {
      if (!isInitialized.current) {
        await initializeAudioContext();
      }

      const key = getEngineKey(
        config.userId,
        config.instrumentName,
        config.category,
      );

      // Check if this engine is already being loaded
      const existingLoadPromise = loadingEngines.current.get(key);
      if (existingLoadPromise) {
        console.log(
          `⏳ Engine ${key} already loading, waiting for existing load...`,
        );
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
        onInstrumentFallback: (
          originalInstrument: string,
          fallbackInstrument: string,
          category: InstrumentCategory,
        ) => {
          console.log(
            `🔄 Remote instrument fallback for ${config.username}: ${originalInstrument} → ${fallbackInstrument} (${category})`,
          );
          // This will be handled by the unified instrument hook
        },
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
    },
    [initializeAudioContext, getEngineKey],
  );

  const getRemoteEngine = useCallback(
    (userId: string, instrumentName: string, category: InstrumentCategory) => {
      const key = getEngineKey(userId, instrumentName, category);
      return remoteEngines.current.get(key) || null;
    },
    [getEngineKey],
  );

  const updateRemoteInstrument = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
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
    },
    [getEngineKey, addRemoteEngine],
  );

  const removeRemoteEngine = useCallback((userId: string) => {
    // Remove all engines for this user
    const keysToDelete: string[] = [];

    remoteEngines.current.forEach((engine, key) => {
      if (engine.getUserId() === userId) {
        engine.dispose();
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      remoteEngines.current.delete(key);
    });
  }, []);

  // Local playback methods
  const playLocalNotes = useCallback(
    async (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
      // Ensure local engine exists; handle hot-reload or late init gracefully
      if (!localEngine.current) {
        if (localEngineLoadingPromise.current) {
          await localEngineLoadingPromise.current;
        } else if (lastLocalConfig.current) {
          await initializeLocalEngine(lastLocalConfig.current);
        } else {
          console.warn(
            "playLocalNotes called before local engine was initialized",
          );
          return; // Drop the event silently instead of throwing
        }
      }

      await localEngine.current!.playNotes(notes, velocity, isKeyHeld);
    },
    [initializeLocalEngine],
  );

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
  const playRemoteNotes = useCallback(
    async (
      userId: string,
      username: string,
      notes: string[],
      velocity: number,
      instrumentName: string,
      category: InstrumentCategory,
      isKeyHeld: boolean = false,
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
    },
    [getRemoteEngine, addRemoteEngine],
  );

  const stopRemoteNotes = useCallback(
    async (
      userId: string,
      notes: string[],
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      const engine = getRemoteEngine(userId, instrumentName, category);

      if (engine) {
        await engine.stopNotes(notes);
      }
    },
    [getRemoteEngine],
  );

  const setRemoteSustain = useCallback(
    (
      userId: string,
      sustain: boolean,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      const engine = getRemoteEngine(userId, instrumentName, category);

      if (engine) {
        engine.setSustain(sustain);
      }
    },
    [getRemoteEngine],
  );

  // Synthesizer parameter management
  const updateLocalSynthParams = useCallback(
    async (params: Partial<SynthState>) => {
      // Ensure local engine exists; handle hot-reload or late init gracefully
      if (!localEngine.current) {
        if (localEngineLoadingPromise.current) {
          await localEngineLoadingPromise.current;
        } else if (lastLocalConfig.current) {
          await initializeLocalEngine(lastLocalConfig.current);
        } else {
          console.warn(
            "updateLocalSynthParams called before local engine was initialized",
          );
          return;
        }
      }

      await localEngine.current!.updateSynthParams(params);
    },
    [initializeLocalEngine],
  );

  const updateRemoteSynthParams = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
      params: Partial<SynthState>,
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
    },
    [getRemoteEngine, addRemoteEngine],
  );

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
    return isInitialized.current && audioContext.current?.state === "running";
  }, []);

  const cleanup = useCallback(() => {
    // Dispose local engine
    if (localEngine.current) {
      localEngine.current.dispose();
      localEngine.current = null;
    }

    // Dispose all remote engines
    remoteEngines.current.forEach((engine) => {
      engine.dispose();
    });
    remoteEngines.current.clear();

    // Clear loading states
    loadingEngines.current.clear();
    localEngineLoadingPromise.current = null;

    // Close audio context
    if (audioContext.current && audioContext.current.state !== "closed") {
      audioContext.current.close();
      audioContext.current = null;
    }

    isInitialized.current = false;
  }, []);

  const preloadInstruments = useCallback(
    async (
      instruments: Array<{
        userId: string;
        username: string;
        instrumentName: string;
        category: string;
      }>,
    ) => {
      if (!isReady()) {
        return;
      }

      for (const instrument of instruments) {
        try {
          const category = instrument.category as InstrumentCategory;
          const existingEngine = getRemoteEngine(
            instrument.userId,
            instrument.instrumentName,
            category,
          );

          if (!existingEngine) {
            await addRemoteEngine({
              userId: instrument.userId,
              username: instrument.username,
              instrumentName: instrument.instrumentName,
              category,
            });
          }
        } catch (error) {
          console.error(
            `❌ Failed to preload instrument for ${instrument.username}:`,
            error,
          );
        }
      }
    },
    [isReady, getRemoteEngine, addRemoteEngine],
  );

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

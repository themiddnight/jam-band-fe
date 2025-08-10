import { getOptimalAudioConfig } from "../constants/audioConfig";
import { useRef, useCallback, useState, useEffect } from "react";

interface AudioContextManagerState {
  isReady: boolean;
  isInitializing: boolean;
  error: string | null;
  context: AudioContext | null;
}

export const useAudioContextManager = () => {
  const contextRef = useRef<AudioContext | null>(null);
  const [state, setState] = useState<AudioContextManagerState>({
    isReady: false,
    isInitializing: false,
    error: null,
    context: null,
  });

  // Memoized context creation to avoid recreating
  const createAudioContext = useCallback(() => {
    if (contextRef.current) {
      return contextRef.current;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API not supported");
      }

      // Get optimal audio configuration for this device
      const audioConfig = getOptimalAudioConfig();

      // Configure audio context for lower latency
      const contextOptions = {
        sampleRate: audioConfig.AUDIO_CONTEXT.sampleRate,
        latencyHint: audioConfig.AUDIO_CONTEXT.latencyHint,
      };

      contextRef.current = new AudioContextClass(contextOptions);

      return contextRef.current;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create audio context";
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Optimized initialization with retry logic
  const initializeAudioContext = useCallback(
    async (retries = 3): Promise<AudioContext> => {
      if (state.isInitializing) {
        // Return existing promise if already initializing
        return new Promise((resolve, reject) => {
          const checkState = () => {
            if (state.isReady && contextRef.current) {
              resolve(contextRef.current);
            } else if (state.error) {
              reject(new Error(state.error));
            } else {
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });
      }

      setState((prev) => ({ ...prev, isInitializing: true, error: null }));

      try {
        const context = createAudioContext();

        // Resume context if suspended
        if (context.state === "suspended") {
          await context.resume();
        }

        // Wait for context to be running
        if (context.state !== "running") {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Audio context failed to start"));
            }, 5000);

            const checkState = () => {
              if (context.state === "running") {
                clearTimeout(timeout);
                resolve();
              } else {
                setTimeout(checkState, 100);
              }
            };
            checkState();
          });
        }

        setState({
          isReady: true,
          isInitializing: false,
          error: null,
          context,
        });

        return context;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to initialize audio context";

        // Retry logic
        if (retries > 0) {
          console.warn(
            `Audio context initialization failed, retrying... (${retries} attempts left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return initializeAudioContext(retries - 1);
        }

        setState({
          isReady: false,
          isInitializing: false,
          error: errorMessage,
          context: null,
        });

        throw new Error(errorMessage);
      }
    },
    [state.isInitializing, state.isReady, state.error, createAudioContext],
  );

  // Suspend context when not needed (for performance)
  const suspendAudioContext = useCallback(async () => {
    if (contextRef.current && contextRef.current.state === "running") {
      await contextRef.current.suspend();
    }
  }, []);

  // Resume context when needed
  const resumeAudioContext = useCallback(async () => {
    if (contextRef.current && contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (contextRef.current && contextRef.current.state !== "closed") {
        contextRef.current.close();
      }
    };
  }, []);

  // Auto-resume on user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      if (contextRef.current && contextRef.current.state === "suspended") {
        contextRef.current.resume();
      }
    };

    // Add event listeners for user interaction
    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, []);

  return {
    ...state,
    initializeAudioContext,
    suspendAudioContext,
    resumeAudioContext,
    getAudioContext: () => contextRef.current,
  };
};

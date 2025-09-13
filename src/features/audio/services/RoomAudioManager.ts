import { AudioContextManager } from "../constants/audioConfig";
import {
  ErrorRecoveryService,
  ErrorType,
  RecoveryAction,
  type ErrorContext,
} from "./ErrorRecoveryService";
import { InstrumentCategory } from "@/shared/constants/instruments";

export interface RoomUser {
  id: string;
  username: string;
  currentInstrument?: string;
  currentCategory?: string;
}

export interface InstrumentPreloadData {
  userId: string;
  username: string;
  instrument: string;
  category: string;
}

/**
 * RoomAudioManager handles Web Audio API initialization timing and instrument preloading
 * according to the room isolation architecture requirements.
 *
 * Requirements addressed:
 * - 10.1: Audio context initialization after successful room join
 * - 10.2: Instrument preloading for existing room users upon join
 * - 10.3: Real-time instrument preloading when users change instruments
 * - 10.4: Audio cleanup when users leave rooms
 * - 10.5: Fallback handling for failed instrument loading
 * - 10.7: Audio context resumption on user interaction
 */
export class RoomAudioManager {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private roomUsers = new Map<string, RoomUser>();
  private preloadedInstruments = new Set<string>();
  private instrumentManager: any = null;
  private cleanupCallbacks = new Set<() => void>();
  private userInteractionListeners = new Set<() => void>();
  private errorRecoveryService: ErrorRecoveryService;
  private ensureMixerChannels = async (users: RoomUser[]) => {
    try {
      const { getOrCreateGlobalMixer } = await import(
        "../utils/effectsArchitecture"
      );
      const mixer = await getOrCreateGlobalMixer();
      users.forEach((u) => {
        if (!mixer.getChannel(u.id)) {
          mixer.createUserChannel(u.id, u.username);
        }
      });
    } catch {
      // ignore if mixer not available
    }
  };

  constructor(instrumentManager?: any) {
    this.instrumentManager = instrumentManager;

    // Initialize error recovery service for audio failures
    this.errorRecoveryService = new ErrorRecoveryService({
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 10000,
      exponentialBackoff: true,
      enableUserFeedback: true,
      enableAutoRecovery: true,
    });

    this.setupErrorRecoveryHandlers();
    this.setupUserInteractionHandlers();
  }

  /**
   * Set up error recovery handlers for audio failures
   * Requirements: 10.6, 10.7 - Fallback mechanisms for audio initialization failures
   */
  private setupErrorRecoveryHandlers(): void {
    this.errorRecoveryService.onRecovery(({ action, context }) => {
      this.handleAudioRecovery(action, context);
    });

    this.errorRecoveryService.onUserFeedback((message, type) => {
      console.log(`🎵 RoomAudioManager ${type.toUpperCase()}: ${message}`);
    });
  }

  /**
   * Handle audio recovery actions
   * Requirements: 10.6, 10.7 - Fallback mechanisms for audio initialization failures
   */
  private async handleAudioRecovery(
    action: RecoveryAction,
    context: ErrorContext,
  ): Promise<void> {
    console.log(
      "🔧 RoomAudioManager: Executing recovery action",
      action,
      "for",
      context.errorType,
    );

    try {
      switch (action) {
        case RecoveryAction.RETRY_CONNECTION:
          await this.retryAudioInitialization();
          break;

        case RecoveryAction.FALLBACK_TO_HTTP:
          await this.fallbackToBasicAudio();
          break;

        case RecoveryAction.FORCE_RECONNECTION:
          await this.reinitializeAudioSystem();
          break;

        case RecoveryAction.SHOW_USER_PROMPT:
          // User feedback is handled by the error recovery service
          break;

        case RecoveryAction.NO_ACTION:
          console.log("🔧 RoomAudioManager: No recovery action needed");
          break;

        default:
          console.warn("🔧 RoomAudioManager: Unknown recovery action", action);
      }
    } catch (error) {
      console.error(
        "❌ RoomAudioManager: Recovery action failed",
        action,
        error,
      );
    }
  }

  /**
   * Retry audio initialization
   */
  private async retryAudioInitialization(): Promise<void> {
    console.log("🔄 RoomAudioManager: Retrying audio initialization");

    try {
      // Reset initialization state
      this.isInitialized = false;
      this.audioContext = null;

      // Retry initialization
      this.audioContext = await AudioContextManager.getInstrumentContext();

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log("✅ RoomAudioManager: Audio initialization retry successful");
    } catch (error) {
      console.error(
        "❌ RoomAudioManager: Audio initialization retry failed",
        error,
      );
      throw error;
    }
  }

  /**
   * Fallback to basic audio mode
   */
  private async fallbackToBasicAudio(): Promise<void> {
    console.log("🔄 RoomAudioManager: Falling back to basic audio mode");

    try {
      // Try to create a basic AudioContext
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: 44100, // Lower sample rate for compatibility
        latencyHint: "playback", // Optimize for playback rather than interaction
      });

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log("✅ RoomAudioManager: Basic audio mode initialized");
    } catch (error) {
      console.error("❌ RoomAudioManager: Basic audio fallback failed", error);
      throw error;
    }
  }

  /**
   * Reinitialize entire audio system
   */
  private async reinitializeAudioSystem(): Promise<void> {
    console.log("🔄 RoomAudioManager: Reinitializing audio system");

    // Clean up current state
    this.cleanup();

    // Reinitialize
    const roomUsers = Array.from(this.roomUsers.values());
    await this.initializeForRoom(roomUsers, this.instrumentManager);
  }

  /**
   * Set the instrument manager reference
   */
  setInstrumentManager(instrumentManager: any): void {
    this.instrumentManager = instrumentManager;
  }

  /**
   * Initialize audio context after successful room join with comprehensive error handling
   * Requirements: 10.1, 10.6, 10.7 - Audio initialization with fallback mechanisms
   */
  async initializeForRoom(
    roomUsers: RoomUser[],
    instrumentManager?: any,
  ): Promise<void> {
    try {
      console.log(
        "🎵 RoomAudioManager: Initializing audio context for room join",
      );

      // Set instrument manager if provided
      if (instrumentManager) {
        this.instrumentManager = instrumentManager;
      }

      // Ensure mixer channels exist for current users
      await this.ensureMixerChannels(roomUsers);

      // Initialize the dedicated instrument audio context with error handling
      try {
        this.audioContext = await AudioContextManager.getInstrumentContext();
      } catch (error) {
        console.error(
          "❌ RoomAudioManager: Failed to get instrument context:",
          error,
        );

        await this.errorRecoveryService.handleError({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
          message: "Failed to initialize instrument audio context",
          originalError:
            error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
          additionalData: { component: "instrument_context" },
        });

        throw error;
      }

      // Ensure context is running with error handling
      try {
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }

        // Verify context is actually running
        if (this.audioContext.state !== "running") {
          throw new Error(
            `Audio context state is ${this.audioContext.state}, expected running`,
          );
        }
      } catch (error) {
        console.error(
          "❌ RoomAudioManager: Failed to resume audio context:",
          error,
        );

        await this.errorRecoveryService.handleError({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
          message: "Failed to resume audio context",
          originalError:
            error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
          additionalData: {
            component: "context_resume",
            contextState: this.audioContext.state,
          },
        });

        throw error;
      }

      this.isInitialized = true;

      // Store room users
      this.updateRoomUsers(roomUsers);

      // Preload instruments for all existing room users with error handling
      try {
        await this.preloadExistingUserInstruments(roomUsers);
      } catch (error) {
        console.error(
          "❌ RoomAudioManager: Failed to preload instruments:",
          error,
        );

        await this.errorRecoveryService.handleError({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
          message: "Failed to preload room instruments",
          originalError:
            error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
          additionalData: {
            component: "instrument_preload",
            userCount: roomUsers.length,
          },
        });

        // Don't throw here - continue with partial initialization
        console.warn(
          "⚠️ RoomAudioManager: Continuing with partial initialization",
        );
      }

      console.log(
        "✅ RoomAudioManager: Audio context initialized and instruments preloaded",
      );
    } catch (error) {
      console.error(
        "❌ RoomAudioManager: Failed to initialize audio context:",
        error,
      );

      // Final error report if not already handled
      if (
        !this.errorRecoveryService.isRecoveryInProgress({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
        })
      ) {
        await this.errorRecoveryService.handleError({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
          message: "Complete audio initialization failure",
          originalError:
            error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
        });
      }

      throw error;
    }
  }

  /**
   * Preload instruments for all existing room users upon join - Requirement 10.2
   */
  private async preloadExistingUserInstruments(
    roomUsers: RoomUser[],
  ): Promise<void> {
    const instrumentsToPreload: InstrumentPreloadData[] = roomUsers
      .filter((user) => user.currentInstrument && user.currentCategory)
      .map((user) => ({
        userId: user.id,
        username: user.username,
        instrument: user.currentInstrument!,
        category: user.currentCategory! as InstrumentCategory,
      }));

    if (instrumentsToPreload.length === 0) {
      console.log(
        "🎵 RoomAudioManager: No instruments to preload for existing users",
      );
      return;
    }

    console.log(
      `🎵 RoomAudioManager: Preloading ${instrumentsToPreload.length} instruments for existing users`,
    );

    await this.preloadInstruments(instrumentsToPreload);
  }

  /**
   * Handle real-time instrument preloading when room users change instruments - Requirement 10.3
   */
  async handleUserInstrumentChange(
    userId: string,
    username: string,
    instrument: string,
    category: string,
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn(
        "🎵 RoomAudioManager: Cannot preload instrument - audio context not initialized",
      );
      return;
    }

    // Update user data
    this.roomUsers.set(userId, {
      id: userId,
      username,
      currentInstrument: instrument,
      currentCategory: category,
    });

    const instrumentKey = `${userId}-${instrument}-${category}`;

    // Skip if already preloaded
    if (this.preloadedInstruments.has(instrumentKey)) {
      console.log(
        `🎵 RoomAudioManager: Instrument ${instrument} already preloaded for ${username}`,
      );
      return;
    }

    console.log(
      `🎵 RoomAudioManager: Preloading new instrument ${instrument} (${category}) for ${username}`,
    );

    try {
      await this.preloadInstruments([
        {
          userId,
          username,
          instrument,
          category: category as InstrumentCategory,
        },
      ]);
    } catch (error) {
      console.error(
        `❌ RoomAudioManager: Failed to preload instrument for ${username}:`,
        error,
      );
      // Fallback handling is implemented in the preloadInstruments method
    }
  }

  /**
   * Preload instruments with fallback handling - Requirement 10.5
   */
  private async preloadInstruments(
    instruments: InstrumentPreloadData[],
  ): Promise<void> {
    if (!this.instrumentManager) {
      console.warn(
        "🎵 RoomAudioManager: No instrument manager available for preloading",
      );
      return;
    }

    if (instruments.length === 0) {
      return;
    }

    try {
      // Try to preload all instruments at once
      await this.instrumentManager.preloadInstruments(instruments);

      // Mark all as preloaded
      instruments.forEach((instrument) => {
        const instrumentKey = `${instrument.userId}-${instrument.instrument}-${instrument.category}`;
        this.preloadedInstruments.add(instrumentKey);
        console.log(
          `✅ RoomAudioManager: Successfully preloaded ${instrument.instrument} for ${instrument.username}`,
        );
      });
    } catch {
      console.warn(
        `⚠️ RoomAudioManager: Batch preload failed, trying individual preloads with fallback`,
      );

      // If batch fails, try individual preloads with fallback handling
      const preloadPromises = instruments.map(async (instrument) => {
        const instrumentKey = `${instrument.userId}-${instrument.instrument}-${instrument.category}`;

        try {
          // Use the instrument manager's preload functionality
          await this.instrumentManager.preloadInstruments([instrument]);

          // Mark as preloaded
          this.preloadedInstruments.add(instrumentKey);

          console.log(
            `✅ RoomAudioManager: Successfully preloaded ${instrument.instrument} for ${instrument.username}`,
          );
        } catch (error) {
          console.error(
            `❌ RoomAudioManager: Failed to preload ${instrument.instrument} for ${instrument.username}:`,
            error,
          );

          // Fallback handling - Requirement 10.5
          await this.handleInstrumentLoadFailure(instrument, error);
        }
      });

      // Use Promise.allSettled to handle individual failures without stopping the entire process
      const results = await Promise.allSettled(preloadPromises);

      const failures = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failures > 0) {
        console.warn(
          `⚠️ RoomAudioManager: ${failures} out of ${instruments.length} instruments failed to preload`,
        );
      }
    }
  }

  /**
   * Handle instrument loading failures with fallback - Requirement 10.5
   */
  private async handleInstrumentLoadFailure(
    instrument: InstrumentPreloadData,
    originalError: any,
  ): Promise<void> {
    console.log(
      `🔄 RoomAudioManager: Attempting fallback for failed instrument ${instrument.instrument}`,
    );

    try {
      // Try to find a compatible fallback instrument
      const fallbackInstrument = await this.findFallbackInstrument(
        instrument.instrument,
        instrument.category as InstrumentCategory,
      );

      if (fallbackInstrument) {
        console.log(
          `🔄 RoomAudioManager: Using fallback instrument ${fallbackInstrument} for ${instrument.username}`,
        );

        // Attempt to preload the fallback
        await this.instrumentManager.preloadInstruments([
          {
            ...instrument,
            instrument: fallbackInstrument,
          },
        ]);

        const fallbackKey = `${instrument.userId}-${fallbackInstrument}-${instrument.category}`;
        this.preloadedInstruments.add(fallbackKey);

        console.log(
          `✅ RoomAudioManager: Successfully loaded fallback instrument ${fallbackInstrument} for ${instrument.username}`,
        );
      } else {
        console.warn(
          `⚠️ RoomAudioManager: No fallback available for ${instrument.instrument} in category ${instrument.category}`,
        );

        // Report fallback failure
        await this.errorRecoveryService.handleError({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
          message: `No fallback instrument available for ${instrument.instrument}`,
          originalError:
            originalError instanceof Error
              ? originalError
              : new Error(String(originalError)),
          timestamp: Date.now(),
          additionalData: {
            component: "instrument_fallback",
            userId: instrument.userId,
            username: instrument.username,
            instrument: instrument.instrument,
            category: instrument.category,
          },
        });
      }
    } catch (fallbackError) {
      console.error(
        `❌ RoomAudioManager: Fallback also failed for ${instrument.username}:`,
        fallbackError,
      );

      // Report complete fallback failure
      await this.errorRecoveryService.handleError({
        errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
        message: `Fallback instrument loading failed for ${instrument.username}`,
        originalError:
          fallbackError instanceof Error
            ? fallbackError
            : new Error(String(fallbackError)),
        timestamp: Date.now(),
        additionalData: {
          component: "fallback_failure",
          userId: instrument.userId,
          username: instrument.username,
          originalInstrument: instrument.instrument,
          category: instrument.category,
          originalError: originalError,
        },
      });
    }
  }

  /**
   * Find a compatible fallback instrument
   */
  private async findFallbackInstrument(
    originalInstrument: string,
    category: InstrumentCategory,
  ): Promise<string | null> {
    // Import the fallback utility
    try {
      const { findNextCompatibleInstrument } = await import(
        "@/shared/utils/webkitCompat"
      );
      return await findNextCompatibleInstrument(
        originalInstrument,
        category,
        new Set([originalInstrument]),
      );
    } catch (error) {
      console.error("Failed to import fallback utility:", error);
      return null;
    }
  }

  /**
   * Handle user leaving room - cleanup their instruments - Requirement 10.4
   */
  handleUserLeft(userId: string): void {
    console.log(
      `🎵 RoomAudioManager: Cleaning up instruments for user ${userId}`,
    );

    // Remove user from tracking
    const user = this.roomUsers.get(userId);
    this.roomUsers.delete(userId);

    // Remove preloaded instruments for this user
    const instrumentsToRemove = Array.from(this.preloadedInstruments).filter(
      (key) => key.startsWith(`${userId}-`),
    );

    instrumentsToRemove.forEach((key) => {
      this.preloadedInstruments.delete(key);
    });

    // Clean up instrument instances through instrument manager
    if (this.instrumentManager && this.instrumentManager.cleanupRemoteUser) {
      this.instrumentManager.cleanupRemoteUser(userId);
    }

    if (user) {
      console.log(
        `✅ RoomAudioManager: Cleaned up instruments for ${user.username} (${userId})`,
      );
    }
  }

  /**
   * Update room users list
   */
  private updateRoomUsers(roomUsers: RoomUser[]): void {
    this.roomUsers.clear();
    roomUsers.forEach((user) => {
      this.roomUsers.set(user.id, user);
    });
  }

  /**
   * Setup user interaction handlers for audio context resumption - Requirement 10.7
   */
  private setupUserInteractionHandlers(): void {
    const resumeAudioContext = async () => {
      if (this.audioContext && this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
          console.log(
            "🎵 RoomAudioManager: Audio context resumed after user interaction",
          );
        } catch (error) {
          console.error(
            "❌ RoomAudioManager: Failed to resume audio context:",
            error,
          );
        }
      }
    };

    // Add event listeners for user interaction
    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      const listener = () => {
        resumeAudioContext();
        // Remove listener after first interaction
        document.removeEventListener(event, listener);
      };

      document.addEventListener(event, listener, { once: true });
      this.userInteractionListeners.add(listener);
    });
  }

  /**
   * Check if audio context is ready
   */
  isAudioContextReady(): boolean {
    return (
      this.isInitialized &&
      this.audioContext !== null &&
      this.audioContext.state === "running"
    );
  }

  /**
   * Get current audio context
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get preloaded instruments count for monitoring
   */
  getPreloadedInstrumentsCount(): number {
    return this.preloadedInstruments.size;
  }

  /**
   * Get room users count
   */
  getRoomUsersCount(): number {
    return this.roomUsers.size;
  }

  /**
   * Add cleanup callback
   */
  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Remove cleanup callback
   */
  removeCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Get error recovery service for external access
   */
  getErrorRecoveryService(): ErrorRecoveryService {
    return this.errorRecoveryService;
  }

  /**
   * Get audio health status
   */
  getAudioHealth(): {
    isHealthy: boolean;
    isInitialized: boolean;
    contextState: string | null;
    preloadedInstrumentsCount: number;
    roomUsersCount: number;
    errorStats: ReturnType<ErrorRecoveryService["getErrorStats"]>;
  } {
    return {
      isHealthy: this.isAudioContextReady(),
      isInitialized: this.isInitialized,
      contextState: this.audioContext?.state || null,
      preloadedInstrumentsCount: this.preloadedInstruments.size,
      roomUsersCount: this.roomUsers.size,
      errorStats: this.errorRecoveryService.getErrorStats(),
    };
  }

  /**
   * Force clear error recovery state (for manual intervention)
   */
  clearErrorRecoveryState(): void {
    this.errorRecoveryService.clearRecoveryState();
  }

  /**
   * Clean up when leaving room - Requirement 10.4
   */
  cleanup(): void {
    console.log("🎵 RoomAudioManager: Cleaning up room audio resources");

    // Clear all tracking data
    this.roomUsers.clear();
    this.preloadedInstruments.clear();

    // Execute cleanup callbacks
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in cleanup callback:", error);
      }
    });
    this.cleanupCallbacks.clear();

    // Clean up user interaction listeners
    this.userInteractionListeners.forEach((listener) => {
      const events = ["click", "touchstart", "keydown"];
      events.forEach((event) => {
        document.removeEventListener(event, listener);
      });
    });
    this.userInteractionListeners.clear();

    // Clean up error recovery service
    this.errorRecoveryService.cleanup();

    // Note: We don't close the audio context here as it might be shared
    // The AudioContextManager handles context lifecycle
    this.audioContext = null;
    this.isInitialized = false;

    console.log("✅ RoomAudioManager: Cleanup completed");
  }

  /**
   * Suspend audio context to save resources when not needed
   */
  async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "running") {
      await this.audioContext.suspend();
      console.log("🎵 RoomAudioManager: Audio context suspended");
    }
  }

  /**
   * Resume audio context
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("🎵 RoomAudioManager: Audio context resumed");
    }
  }
}

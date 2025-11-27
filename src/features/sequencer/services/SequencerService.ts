import * as Tone from "tone";
import type { SequencerStep, SequencerSpeed } from "../types";
import { SEQUENCER_CONSTANTS, SEQUENCER_SPEEDS } from "@/shared/constants";
import { getSequencerWorker } from './SequencerWorkerService';

export interface SequencerServiceEvents {
  onBeatChange: (beat: number) => void;
  onPlayStep: (steps: SequencerStep[]) => void;
  onMetronomeSync: () => void;
  onError: (error: string) => void;
}

export class SequencerService {
  private sequence: Tone.Sequence | null = null;
  private isInitialized = false;
  private currentBPM = 0; // Start with 0, will be set by metronome
  private currentSpeed: SequencerSpeed = SEQUENCER_CONSTANTS.DEFAULT_SPEED;
  private sequenceLength: number = SEQUENCER_CONSTANTS.DEFAULT_LENGTH;
  private events: SequencerServiceEvents;
  private stepsData: SequencerStep[] = [];
  private isPlaying = false;
  private lastMetronomeTime = 0;
  private scheduledStartTime: number | null = null;
  private startOnNextTick: boolean = false;
  private currentBeatIndex: number = 0;
  private useManualScheduling: boolean = true;
  private tickCounter: number = 0; // For slower speeds that need multiple ticks per step
  private previousSpeed: SequencerSpeed | null = null; // Track speed changes
  private animationFrameId: number | null = null; // For RAF-based scheduling
  private worker = getSequencerWorker(); // Web Worker for heavy calculations
  private beatStepsCache: Map<number, SequencerStep[]> = new Map(); // Cached beat data for fast access

  constructor(events: SequencerServiceEvents) {
    this.events = events;
  }

  /**
   * Initialize the sequencer service
   */
  async initialize(): Promise<void> {
    try {
      // Mark as initialized even if AudioContext isn't ready yet
      // AudioContext will be started when needed (e.g., on play button click)
      this.isInitialized = true;
      
    } catch (error) {
      const errorMessage = `Failed to initialize sequencer: ${error}`;
      console.error(errorMessage);
      this.events.onError(errorMessage);
    }
  }

  /**
   * Update sequencer settings
   */
  updateSettings(bpm: number, speed: SequencerSpeed, length: number): void {
    
    const lengthChanged = this.sequenceLength !== length;
    
    this.currentBPM = bpm;
    this.currentSpeed = speed;
    this.sequenceLength = length;

    // If sequence length changed, recompute beat data
    if (lengthChanged) {
      this.precomputeBeatData();
    }

    // Update worker state
    this.syncWorkerState();

    if (this.sequence) {
      this.updateSequenceSettings();
    }
  }

  /**
   * Set the steps data for the sequencer
   */
  setSteps(steps: SequencerStep[]): void {
    
    this.stepsData = steps;
    
    
    // Precompute beat data for fast access during playback (main thread optimization)
    this.precomputeBeatData();
    
    // Update worker with new steps data for off-thread processing
    this.syncWorkerState();
    
    if (this.sequence && this.isPlaying) {
      this.updateSequenceSteps();
    }
  }

  /**
   * Sync current state with worker for off-thread processing
   */
  private async syncWorkerState(): Promise<void> {
    try {
      await this.worker.updateState({
        stepsData: this.stepsData,
        settings: {
          speed: this.currentSpeed,
          length: this.sequenceLength
        }
      });
    } catch (error) {
      console.warn('Failed to sync worker state:', error);
    }
  }

  /**
   * Get steps for beat synchronously (fallback for when async isn't possible)
   */
  private getStepsForBeatSync(beat: number): SequencerStep[] {
    // Use cached data if available (much faster than filtering)
    if (this.beatStepsCache.has(beat)) {
      return this.beatStepsCache.get(beat)!;
    }
    
    // Fallback to filtering if cache miss
    return this.stepsData.filter(step => step.beat === beat && step.enabled);
  }

  /**
   * Precompute steps for each beat for fast access during playback
   * This moves the heavy computation out of the critical timing path
   */
  private precomputeBeatData(): void {
    // Clear existing cache
    this.beatStepsCache.clear();
    
    // Precompute for all possible beats in sequence
    for (let beat = 0; beat < this.sequenceLength; beat++) {
      const stepsForBeat = this.stepsData.filter(step => 
        step.beat === beat && step.enabled
      );
      this.beatStepsCache.set(beat, stepsForBeat);
    }
  }

  /**
   * Schedule playback to start on the next websocket metronome tick
   */
  scheduleStartOnNextTick(): void {
    this.startOnNextTick = true;
    this.scheduledStartTime = null;
  }

  /**
   * Start sequencer playback synchronized with metronome
   */
  async startPlayback(nextStartOffsetSeconds?: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Don't start if we don't have a valid BPM yet
    if (this.currentBPM <= 0) {
      throw new Error("Cannot start sequencer: BPM not yet received from metronome");
    }
    
    // Check if Tone.js context is ready
    if (Tone.getContext().state !== "running") {
      
      await Tone.start();
    }

    // Ensure the global transport is running (required for Tone.Sequence)
    const transport = Tone.getTransport();
    if (transport.state !== "started") {
      transport.start();
    }

    // Keep transport BPM roughly in sync (even though we schedule in seconds)
    try {
      transport.bpm.value = this.currentBPM;
    } catch {
      // Ignore transport assignment errors in environments where it's immutable
    }

    

    try {
      // Stop any existing sequence
      this.stopPlayback();

      // Calculate sequencer timing based on speed
      const speedConfig = SEQUENCER_SPEEDS.find(s => s.value === this.currentSpeed);
      if (!speedConfig) {
        throw new Error(`Invalid sequencer speed: ${this.currentSpeed}`);
      }

      // Calculate the interval for each step
      const baseInterval = 60 / this.currentBPM; // Seconds per beat at current BPM
      const stepInterval = baseInterval / speedConfig.bpmMultiplier;

      if (this.useManualScheduling) {
        // Manual scheduling mode aligned to websocket ticks
        this.isPlaying = true;
        this.currentBeatIndex = 0;
        
        // Actual start happens in syncWithMetronome when startOnNextTick is true
      } else {
        // Tone.Sequence mode (fallback)
        const sequenceData = Array.from({ length: this.sequenceLength }, (_, beat) => beat);
        const intervalString = `${stepInterval}s`;

        this.sequence = new Tone.Sequence(
          (_time, beat) => {
            // For beat 0, notify beat change FIRST to allow bank switching before playing steps
            if (beat === 0) {
              this.events.onBeatChange(beat);
              
              // Use queueMicrotask to ensure state updates are processed before playing steps
              const playStepsAfterBankSwitch = () => {
                if (!this.isPlaying) return;
                
                // Play steps for this beat after bank switch
                const stepsForBeat = this.getStepsForBeatSync(beat);
                if (stepsForBeat.length > 0) {
                  this.events.onPlayStep(stepsForBeat);
                }
              };
              
              // Use queueMicrotask to ensure bank switching state updates are processed
              queueMicrotask(playStepsAfterBankSwitch);
            } else {
              // For non-zero beats, play steps first then notify beat change (normal order)
              const stepsForBeat = this.getStepsForBeatSync(beat);
              if (stepsForBeat.length > 0) {
                this.events.onPlayStep(stepsForBeat);
              }
              this.events.onBeatChange(beat);
            }
          },
          sequenceData,
          intervalString
        );

        this.sequence.loop = true;
        this.sequence.humanize = false;

        if (typeof nextStartOffsetSeconds === "number" && nextStartOffsetSeconds > 0) {
          this.scheduledStartTime = Tone.now() + nextStartOffsetSeconds;
          this.sequence.start(`+${nextStartOffsetSeconds}`);
          
        } else {
          this.scheduledStartTime = null;
          this.sequence.start();
          
        }

        
        this.isPlaying = true;
      }

      

    } catch (error) {
      const errorMessage = `Failed to start sequencer: ${error}`;
      console.error(errorMessage);
      this.events.onError(errorMessage);
    }
  }

  /**
   * Stop sequencer playback
   */
  stopPlayback(): void {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
    
    // Cancel any pending animation frames
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.isPlaying = false;
    this.scheduledStartTime = null;
    
  }

  /**
   * Pause sequencer playback
   */
  pausePlayback(): void {
    if (this.sequence) {
      this.sequence.stop();
    }
    this.isPlaying = false;
    
  }

  /**
   * Resume sequencer playback
   */
  resumePlayback(): void {
    if (this.sequence) {
      this.sequence.start();
      this.isPlaying = true;
      
    }
  }

  /**
   * Synchronize with metronome tick
   */
  syncWithMetronome(metronomeTime: number, bpm: number): void {
    this.lastMetronomeTime = metronomeTime;
    this.currentBPM = bpm;

    if (this.useManualScheduling) {
      if (!this.isPlaying) {
        return;
      }

      const speedConfig = SEQUENCER_SPEEDS.find(s => s.value === this.currentSpeed)!;
      const stepsPerBeat = speedConfig.bpmMultiplier; // e.g., 8 for 1/8, 4 for 1/4
      
      
      
      // Start on this tick if requested
      if (this.startOnNextTick) {
        this.startOnNextTick = false;
        this.currentBeatIndex = 0;
        this.tickCounter = 0; // Reset tick counter on start
        this.previousSpeed = this.currentSpeed;
        
      }
      
      // Reset tick counter if speed changed during playback (for instant speed changes)
      if (this.previousSpeed !== this.currentSpeed) {
        this.tickCounter = 0;
        this.previousSpeed = this.currentSpeed;
      }
      
      // Increment tick counter
      this.tickCounter++;
      
      // Handle different speeds:
      // stepsPerBeat >= 1: Multiple steps per metronome tick (fast speeds like 1/4, 1/8)
      // stepsPerBeat < 1: One step per multiple metronome ticks (slow speeds like 2, 4)
      
      if (stepsPerBeat >= 1) {
        // Fast speeds: Play multiple beats sequentially within one metronome tick
        const beatsThisTick = Math.round(stepsPerBeat);
        const subInterval = (60 / this.currentBPM) / beatsThisTick; // Time between beats within this tick
        
        
        
        // Use RAF-based scheduling for better timing precision
        const startTime = performance.now();
        
        for (let i = 0; i < beatsThisTick; i++) {
          const beat = (this.currentBeatIndex + i) % this.sequenceLength;
          const targetTime = startTime + (i * subInterval * 1000); // Target time for this beat
          
          // Schedule each beat with RAF for frame-synchronized timing
          const scheduleRAF = (currentTime: number) => {
            if (!this.isPlaying) return; // Guard against stopping mid-sequence
            
            const timeDiff = targetTime - currentTime;
            
            if (timeDiff <= 16.67) { // Within one frame (60fps = 16.67ms)
              
              
              // For beat 0, notify beat change FIRST to allow bank switching before playing steps
              if (beat === 0) {
                
                this.events.onBeatChange(beat);
                
                
                // Use queueMicrotask to ensure state updates are processed before playing steps
                const playStepsAfterBankSwitch = () => {
                  if (!this.isPlaying) return;
                  
                  // Play steps for this beat after bank switch
                  const stepsForBeat = this.getStepsForBeatSync(beat);
                  console.log(`🎵 Found ${stepsForBeat.length} steps for beat ${beat} (after bank switch)`, {
                    steps: stepsForBeat.map(s => ({ note: s.note, beat: s.beat, gate: s.gate }))
                  });
                  if (stepsForBeat.length > 0) {
                    this.events.onPlayStep(stepsForBeat);
                  }
                };
                
                // Use queueMicrotask to ensure bank switching state updates are processed
                queueMicrotask(playStepsAfterBankSwitch);
              } else {
                // For non-zero beats, play steps first then notify beat change (normal order)
                const stepsForBeat = this.getStepsForBeatSync(beat);
                
                if (stepsForBeat.length > 0) {
                  this.events.onPlayStep(stepsForBeat);
                }
                
                // Notify UI of beat change
                this.events.onBeatChange(beat);
              }
            } else {
              // Still too early, schedule another RAF
              this.animationFrameId = requestAnimationFrame(scheduleRAF);
            }
          };
          
          // Start RAF scheduling for this beat
          this.animationFrameId = requestAnimationFrame(scheduleRAF);
        }
        
        // Advance beat index by the number of beats we played
        this.currentBeatIndex = (this.currentBeatIndex + beatsThisTick) % this.sequenceLength;
        
      } else {
        // Slow speeds: Wait multiple ticks before advancing one step
        const ticksPerBeat = Math.round(1 / stepsPerBeat); // e.g., speed 4 = wait 4 ticks per beat
        
        
        
        if (this.tickCounter % ticksPerBeat === 0) {
          // Time to play a beat
          const beat = this.currentBeatIndex % this.sequenceLength;
          
          
          
          // For beat 0, notify beat change FIRST to allow bank switching before playing steps
          if (beat === 0) {
            this.events.onBeatChange(beat);
            
            // Use queueMicrotask to ensure state updates are processed before playing steps
            const playStepsAfterBankSwitch = () => {
              if (!this.isPlaying) return;
              
              // Play steps for this beat after bank switch
              const stepsForBeat = this.getStepsForBeatSync(beat);
              console.log(`🎵 Found ${stepsForBeat.length} steps for beat ${beat} (after bank switch)`, {
                steps: stepsForBeat.map(s => ({ note: s.note, beat: s.beat, gate: s.gate }))
              });
              if (stepsForBeat.length > 0) {
                this.events.onPlayStep(stepsForBeat);
              }
            };
            
            // Use queueMicrotask to ensure bank switching state updates are processed
            queueMicrotask(playStepsAfterBankSwitch);
          } else {
            // For non-zero beats, play steps first then notify beat change (normal order)
            const stepsForBeat = this.getStepsForBeatSync(beat);
            
            if (stepsForBeat.length > 0) {
              this.events.onPlayStep(stepsForBeat);
            }
            
            // Notify UI of beat change
            this.events.onBeatChange(beat);
          }
          
          // Advance to next beat
          this.currentBeatIndex = (this.currentBeatIndex + 1) % this.sequenceLength;
          
        }
      }

      this.events.onMetronomeSync();
      return;
    }

    // If we're waiting to start, begin immediately on this tick (Tone.Sequence mode)
    if (!this.isPlaying && this.startOnNextTick) {
      
      this.startOnNextTick = false;
      this.startPlayback();
    }

    // Update sequence timing if already playing
    if (this.sequence && this.isPlaying) {
      this.updateSequenceSettings();
    }

    this.events.onMetronomeSync();
  }

  /**
   * Get the next metronome-aligned start time
   */
  getNextStartTime(): number {
    if (this.lastMetronomeTime === 0) {
      return 0; // Use immediate start; we now align on the next websocket tick
    }

    // Legacy calculation kept for reference; prefer scheduleStartOnNextTick()
    const beatDuration = 60 / this.currentBPM;
    const timeSinceLastTick = Tone.now() - this.lastMetronomeTime;
    const nextTickTime = Math.ceil(timeSinceLastTick / beatDuration) * beatDuration;
    // Return offset seconds from now
    return Math.max(0, nextTickTime - timeSinceLastTick);
  }

  /**
   * Update sequence settings (private helper)
   */
  private updateSequenceSettings(): void {
    if (!this.sequence) return;

    const speedConfig = SEQUENCER_SPEEDS.find(s => s.value === this.currentSpeed);
    if (!speedConfig) return;
  }

  /**
   * Update sequence steps (private helper)
   */
  private updateSequenceSteps(): void {
    // Note: For Tone.js sequences, we can't dynamically update the callback easily,
    // so we rely on the stepsData being updated and the callback reading from it
    
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): {
    isPlaying: boolean;
    isScheduled: boolean;
    currentBPM: number;
    currentSpeed: SequencerSpeed;
    sequenceLength: number;
  } {
    return {
      isPlaying: this.isPlaying,
      isScheduled: this.scheduledStartTime !== null,
      currentBPM: this.currentBPM,
      currentSpeed: this.currentSpeed,
      sequenceLength: this.sequenceLength,
    };
  }

  /**
   * Calculate step timing for a given speed
   */
  static calculateStepTiming(bpm: number, speed: SequencerSpeed): {
    stepInterval: number;
    stepsPerBeat: number;
    beatsPerStep: number;
  } {
    const speedConfig = SEQUENCER_SPEEDS.find(s => s.value === speed);
    if (!speedConfig) {
      throw new Error(`Invalid sequencer speed: ${speed}`);
    }

    const baseInterval = 60 / bpm; // Seconds per beat
    const stepInterval = baseInterval / speedConfig.bpmMultiplier;
    
    return {
      stepInterval,
      stepsPerBeat: speedConfig.bpmMultiplier,
      beatsPerStep: 1 / speedConfig.bpmMultiplier,
    };
  }

  /**
   * Check if sequencer is ready for playback
   */
  isReady(): boolean {
    return this.isInitialized && Tone.getContext().state === "running";
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopPlayback();
    this.isInitialized = false;
    
  }
} 
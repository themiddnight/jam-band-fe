/**
 * SequencerWorkerService - Manages Web Worker for heavy sequencer calculations
 * Keeps UI responsive by offloading beat processing to background thread
 */
import type { SequencerStep } from '../types';

interface WorkerResponse {
  type: 'RESULT' | 'ERROR' | 'READY';
  id?: string;
  data: any;
}

export class SequencerWorkerService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  private messageId = 0;
  private isReady = false;

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize the Web Worker
   */
  private async initializeWorker(): Promise<void> {
    try {
      // Create worker from inline script to avoid external file dependency
      const workerScript = this.createWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Wait for worker to be ready
      await this.waitForReady();
      
      // Clean up URL
      URL.revokeObjectURL(workerUrl);
      
      
    } catch (error) {
      console.error('Failed to initialize SequencerWorker:', error);
      // Fallback: disable worker functionality
      this.worker = null;
    }
  }

  /**
   * Create the worker script as a string (inline worker)
   */
  private createWorkerScript(): string {
    return `
      class SequencerWorker {
        constructor() {
          this.banks = {};
          this.settings = { speed: 0.25, length: 16, displayMode: 'full' };
          this.currentBank = 'A';
          this.stepsData = [];
          
        }

        /**
         * Filter steps for a specific beat - this is the heavy operation we're optimizing
         */
        processStepsForBeat(beat) {
          const startTime = performance.now();
          
          // This filter operation can be expensive with many steps
          const steps = this.stepsData.filter(step => 
            step.beat === beat && step.enabled
          );
          
          const endTime = performance.now();
          
          
          return steps;
        }

        /**
         * Process beat change with all related calculations
         */
        processBeatChange(beat) {
          const startTime = performance.now();
          
          const steps = this.processStepsForBeat(beat);
          const result = {
            beat,
            steps,
            nextBeat: (beat + 1) % this.settings.length,
            stepCount: steps.length,
            processingTime: performance.now() - startTime
          };
          
          return result;
        }

        /**
         * Batch process multiple beats for efficiency
         */
        batchProcessBeats(beats) {
          const startTime = performance.now();
          
          const results = beats.map(beat => {
            const steps = this.processStepsForBeat(beat);
            return {
              beat,
              steps,
              stepCount: steps.length
            };
          });
          
          const endTime = performance.now();
          
          
          return results;
        }

        /**
         * Update worker state from main thread
         */
        updateState(newState) {
          if (newState.banks) {
            this.banks = newState.banks;
            
          }
          
          if (newState.settings) {
            this.settings = { ...this.settings, ...newState.settings };
            
          }
          
          if (newState.currentBank) {
            this.currentBank = newState.currentBank;
            
          }
          
          if (newState.stepsData) {
            this.stepsData = newState.stepsData;
            
          }
        }

        /**
         * Get steps for a specific bank and beat (for UI operations)
         */
        getStepsForBeat(bankId, beat) {
          const bank = this.banks[bankId];
          if (!bank || !bank.steps) return [];
          
          return bank.steps.filter(step => 
            step.beat === beat && step.enabled
          );
        }

        /**
         * Preprocess sequence data for faster runtime performance
         */
        preprocessSequence() {
          const startTime = performance.now();
          
          // Create beat-indexed lookup for faster access
          const beatLookup = {};
          for (let beat = 0; beat < this.settings.length; beat++) {
            beatLookup[beat] = this.stepsData.filter(step => 
              step.beat === beat && step.enabled
            );
          }
          
          const endTime = performance.now();
          
          
          return beatLookup;
        }
      }

      const sequencerWorker = new SequencerWorker();

      self.onmessage = function(e) {
        const { type, id, data } = e.data;
        
        try {
          let result;
          
          switch (type) {
            case 'UPDATE_STATE':
              sequencerWorker.updateState(data);
              result = { success: true };
              break;
              
            case 'PROCESS_BEAT_STEPS':
              result = sequencerWorker.processStepsForBeat(data.beat);
              break;
              
            case 'PROCESS_BEAT_CHANGE':
              result = sequencerWorker.processBeatChange(data.beat);
              break;
              
            case 'BATCH_PROCESS_BEATS':
              result = sequencerWorker.batchProcessBeats(data.beats);
              break;
              
            case 'GET_BEAT_STEPS':
              result = sequencerWorker.getStepsForBeat(data.bankId, data.beat);
              break;
              
            case 'PREPROCESS_SEQUENCE':
              result = sequencerWorker.preprocessSequence();
              break;
              
            default:
              throw new Error('Unknown message type: ' + type);
          }
          
          self.postMessage({ type: 'RESULT', id, data: result });
        } catch (error) {
          self.postMessage({ 
            type: 'ERROR', 
            id, 
            data: { message: error.message, stack: error.stack } 
          });
        }
      };

      // Signal that worker is ready
      self.postMessage({ type: 'READY', data: { message: 'SequencerWorker ready' } });
    `;
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { type, id, data } = event.data;

    if (type === 'READY') {
      this.isReady = true;
      
      return;
    }

    if (!id) return;

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);

    if (type === 'RESULT') {
      pending.resolve(data);
    } else if (type === 'ERROR') {
      console.error('Worker error:', data);
      pending.reject(new Error(data.message));
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('SequencerWorker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Worker error: ' + error.message));
    });
    this.pendingRequests.clear();
  }

  /**
   * Wait for worker to be ready
   */
  private async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const checkReady = () => {
        if (this.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 10);
        }
      };
      checkReady();
    });
  }

  /**
   * Send message to worker and get response
   */
  private async sendMessage(type: string, data: any): Promise<any> {
    if (!this.worker || !this.isReady) {
      // Fallback: process on main thread
      console.warn('🎵 Worker not available, using fallback processing');
      return this.fallbackProcessing(type, data);
    }

    const id = (++this.messageId).toString();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({ type, id, data });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Fallback processing when worker is not available
   */
  private fallbackProcessing(type: string, data: any): any {
    // Simple fallback implementations for when worker fails
    switch (type) {
      case 'PROCESS_BEAT_STEPS':
        
        return []; // Return empty for fallback
      case 'PROCESS_BEAT_CHANGE':
        return { 
          beat: data.beat, 
          steps: [], 
          stepCount: 0, 
          processingTime: 0,
          fallback: true 
        };
      case 'BATCH_PROCESS_BEATS':
        return data.beats.map((beat: number) => ({ 
          beat, 
          steps: [], 
          stepCount: 0 
        }));
      default:
        return null;
    }
  }

  /**
   * Update worker state (banks, settings, etc.)
   */
  async updateState(state: {
    banks?: any;
    settings?: any;
    currentBank?: string;
    stepsData?: SequencerStep[];
  }): Promise<void> {
    try {
      await this.sendMessage('UPDATE_STATE', state);
    } catch (error) {
      console.warn('Failed to update worker state:', error);
    }
  }

  /**
   * Process steps for a specific beat (main optimization target)
   * This replaces the heavy filter operation in SequencerService
   */
  async processStepsForBeat(beat: number): Promise<SequencerStep[]> {
    try {
      const result = await this.sendMessage('PROCESS_BEAT_STEPS', { beat });
      return result;
    } catch (error) {
      console.warn('Failed to process beat steps in worker:', error);
      return [];
    }
  }

  /**
   * Process beat change with all related calculations
   */
  async processBeatChange(beat: number): Promise<{
    beat: number;
    steps: SequencerStep[];
    stepCount: number;
    processingTime?: number;
    fallback?: boolean;
  }> {
    try {
      const result = await this.sendMessage('PROCESS_BEAT_CHANGE', { beat });
      return result;
    } catch (error) {
      console.warn('Failed to process beat change in worker:', error);
      return { beat, steps: [], stepCount: 0, fallback: true };
    }
  }

  /**
   * Batch process multiple beats (optimization for sequence changes)
   */
  async batchProcessBeats(beats: number[]): Promise<Array<{
    beat: number;
    steps: SequencerStep[];
    stepCount: number;
  }>> {
    try {
      const result = await this.sendMessage('BATCH_PROCESS_BEATS', { beats });
      return result;
    } catch (error) {
      console.warn('Failed to batch process beats in worker:', error);
      return beats.map(beat => ({ beat, steps: [], stepCount: 0 }));
    }
  }

  /**
   * Get steps for a specific bank and beat (for UI operations)
   */
  async getStepsForBeat(bankId: string, beat: number): Promise<SequencerStep[]> {
    try {
      const result = await this.sendMessage('GET_BEAT_STEPS', { bankId, beat });
      return result;
    } catch (error) {
      console.warn('Failed to get beat steps from worker:', error);
      return [];
    }
  }

  /**
   * Preprocess sequence for faster runtime performance
   */
  async preprocessSequence(): Promise<Record<number, SequencerStep[]>> {
    try {
      const result = await this.sendMessage('PREPROCESS_SEQUENCE', {});
      return result;
    } catch (error) {
      console.warn('Failed to preprocess sequence in worker:', error);
      return {};
    }
  }

  /**
   * Check if worker is available and ready
   */
  isWorkerReady(): boolean {
    return this.worker !== null && this.isReady;
  }

  /**
   * Get worker performance stats
   */
  getStats(): { isReady: boolean; pendingRequests: number } {
    return {
      isReady: this.isReady,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Cleanup worker
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.isReady = false;
    
  }
}

// Singleton instance
let workerInstance: SequencerWorkerService | null = null;

export const getSequencerWorker = (): SequencerWorkerService => {
  if (!workerInstance) {
    workerInstance = new SequencerWorkerService();
  }
  return workerInstance;
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (workerInstance) {
      workerInstance.destroy();
      workerInstance = null;
    }
  });
} 
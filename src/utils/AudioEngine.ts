import { createWebKitCompatibleAudioContext } from './webkitCompat';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private initPromise: Promise<AudioContext> | null = null;

  async initialize(): Promise<AudioContext> {
    if (this.isInitialized && this.audioContext) {
      return this.audioContext;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeAudioContext();
    return this.initPromise;
  }

  private async _initializeAudioContext(): Promise<AudioContext> {
    try {
      this.audioContext = await createWebKitCompatibleAudioContext();

      // Ensure context is running
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      if (this.audioContext.state !== "running") {
        throw new Error(`AudioContext state is ${this.audioContext.state}, expected 'running'`);
      }

      this.isInitialized = true;
      console.log('AudioEngine initialized successfully');
      return this.audioContext;
    } catch (error) {
      console.error('Failed to initialize AudioEngine:', error);
      this.initPromise = null;
      throw error;
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isReady(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running';
  }

  async ensureReady(): Promise<AudioContext> {
    if (!this.isReady()) {
      return this.initialize();
    }
    return this.audioContext!;
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
} 
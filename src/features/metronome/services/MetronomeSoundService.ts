// Metronome Sound Service

import { METRONOME_CONFIG } from '../constants';
import { AudioContextManager } from '../../audio/constants/audioConfig';

export class MetronomeSoundService {
  private isInitialized = false;

  constructor() {
    this.initializeAudioResources();
  }

  private async initializeAudioResources() {
    try {
      // Ensure the shared instrument AudioContext is available
      await AudioContextManager.getInstrumentContext();
      this.isInitialized = true;
      console.log('🎼 MetronomeSoundService: Initialized with shared AudioContext (oscillator mode)');
    } catch (error) {
      console.warn('Failed to initialize metronome audio resources:', error);
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeAudioResources();
    }
    
    const audioContext = await AudioContextManager.getInstrumentContext();
    if (!audioContext) {
      console.warn('AudioContext not available');
      return;
    }

    // Resume AudioContext if it's suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  async playTick(volume: number = 0.5): Promise<void> {
    await this.ensureInitialized();
    
    const audioContext = await AudioContextManager.getInstrumentContext();
    if (!audioContext) return;

    // Always use oscillator-based tick sound
    this.playTickDirect(volume);
  }

  private async playTickDirect(volume: number): Promise<void> {
    const audioContext = await AudioContextManager.getInstrumentContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const masterBus = AudioContextManager.getMasterBus();

    oscillator.connect(gainNode);
    if (masterBus) {
      masterBus.routeToMaster(gainNode);
    } else {
      gainNode.connect(audioContext.destination);
    }

    oscillator.frequency.setValueAtTime(METRONOME_CONFIG.TICK_FREQUENCY, audioContext.currentTime);
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + METRONOME_CONFIG.TICK_DURATION);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + METRONOME_CONFIG.TICK_DURATION);
  }

  // No cleanup needed since we're using shared resources
  cleanup(): void {
    this.isInitialized = false;
  }
}

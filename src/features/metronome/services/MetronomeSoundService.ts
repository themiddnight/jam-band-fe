// Metronome Sound Service

import { METRONOME_CONFIG, METRONOME_SOUND_PATH } from '../constants';

export class MetronomeSoundService {
  private audioContext: AudioContext | null = null;
  private tickSound: AudioBuffer | null = null;
  private isAudioFileLoaded = false;

  constructor() {
    this.initializeAudioContext();
    this.loadTickSound();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Failed to initialize AudioContext:', error);
    }
  }

  private async loadTickSound() {
    if (!this.audioContext) return;

    try {
      const response = await fetch(METRONOME_SOUND_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load tick sound: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.tickSound = await this.audioContext.decodeAudioData(arrayBuffer);
      this.isAudioFileLoaded = true;
      console.log('Metronome tick sound loaded successfully');
    } catch (error) {
      console.warn('Failed to load tick sound file, will use oscillator fallback:', error);
      this.isAudioFileLoaded = false;
    }
  }

  playTick(volume: number = METRONOME_CONFIG.DEFAULT_VOLUME) {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return;
    }

    // Resume AudioContext if it's suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    try {
      if (this.isAudioFileLoaded && this.tickSound) {
        this.playAudioBufferTick(volume);
      } else {
        this.playOscillatorTick(volume);
      }
    } catch (error) {
      console.warn('Failed to play tick sound:', error);
    }
  }

  private playAudioBufferTick(volume: number) {
    if (!this.audioContext || !this.tickSound) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = this.tickSound;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    source.start(0);
  }

  private playOscillatorTick(volume: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(METRONOME_CONFIG.TICK_FREQUENCY, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + METRONOME_CONFIG.TICK_DURATION);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + METRONOME_CONFIG.TICK_DURATION);
  }

  // Test if sound file is available
  get hasAudioFile(): boolean {
    return this.isAudioFileLoaded;
  }

  // Retry loading the sound file
  async reloadSound(): Promise<void> {
    await this.loadTickSound();
  }
}

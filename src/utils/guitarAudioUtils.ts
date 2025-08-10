/**
 * Audio file placement instructions:
 *
 * Place your guitar audio sample files in the following directory structure:
 *
 * jam-band-fe/public/audio/guitar/
 * ├── muted-note.mp3    # Muted guitar string sound
 * └── snap-sound.mp3    # Guitar string snap sound
 *
 * File requirements:
 * - Format: MP3, WAV, or OGG
 * - Duration: 0.5-2 seconds for muted note, 0.1-0.5 seconds for snap
 * - Sample rate: 44.1kHz recommended
 * - Bit depth: 16-bit or 24-bit
 *
 * You can also add additional guitar samples:
 * - string-squeak.mp3
 * - fret-noise.mp3
 * - pick-attack.mp3
 */
import { loadAudioBufferWithCache } from "./audioBufferCache";

// Guitar audio utilities for handling muted and snap sounds

export interface GuitarAudioSamples {
  mutedNote: string; // Path to muted note sound file
  snapSound: string; // Path to snap sound file
}

// Default audio sample paths
// TODO: Replace these with actual audio file paths
export const DEFAULT_GUITAR_AUDIO_SAMPLES: GuitarAudioSamples = {
  mutedNote: "/audio/guitar/muted-note.mp3",
  snapSound: "/audio/guitar/snap-sound.mp3",
};

export const loadGuitarAudioSample = async (
  samplePath: string,
): Promise<AudioBuffer> => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    return await loadAudioBufferWithCache(samplePath, audioContext);
  } catch (error) {
    console.warn(`Failed to load guitar audio sample: ${samplePath}`, error);
    throw error;
  }
};

export const playGuitarAudioSample = async (
  samplePath: string,
  volume: number = 1.0,
  playbackRate: number = 1.0,
): Promise<void> => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const audioBuffer = await loadGuitarAudioSample(samplePath);

    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = audioBuffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start();
  } catch (error) {
    console.warn(`Failed to play guitar audio sample: ${samplePath}`, error);
  }
};

export const playMutedNote = async (velocity: number = 0.5): Promise<void> => {
  await playGuitarAudioSample(DEFAULT_GUITAR_AUDIO_SAMPLES.mutedNote, velocity);
};

export const playSnapSound = async (velocity: number = 0.5): Promise<void> => {
  await playGuitarAudioSample(DEFAULT_GUITAR_AUDIO_SAMPLES.snapSound, velocity);
};

// Strum effect utilities
export const playStrumEffect = async (
  notes: string[],
  direction: "up" | "down",
  speed: number,
): Promise<void> => {
  // TODO: Implement strum effect with individual note timing
  // This would play notes in sequence with timing based on strum speed
  console.log(
    `Strumming ${notes.length} notes ${direction} at ${speed}ms intervals`,
  );

  // For now, just play all notes together
  // In a real implementation, you'd space them out based on the strum speed
  for (const note of notes) {
    // Play each note with a slight delay based on strum direction and speed
    setTimeout(() => {
      // TODO: Play individual note
      console.log(`Playing note: ${note}`);
    }, 0);
  }
};

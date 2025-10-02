/**
 * GM Note Mapper Utility
 * Handles mapping between General MIDI notes and drum samples for consistent playback
 */

import { mapSampleToGMNote, getPadNotesForPage } from '../constants/generalMidiPercussion';

/**
 * Global mapping store for GM notes to actual samples
 * This is updated when drum instruments load their samples
 */
class GMNoteMapperService {
  private gmNoteToSampleMap: Map<string, string> = new Map();
  private sampleToGMNoteMap: Map<string, string> = new Map();

  /**
   * Initialize the mapper with available samples
   * Creates bidirectional mapping between GM notes and samples
   */
  initialize(availableSamples: string[]): void {
    this.gmNoteToSampleMap.clear();
    this.sampleToGMNoteMap.clear();

    // Get the first page of GM notes (most common drum sounds)
    const gmNotes = getPadNotesForPage(0);
    const usedGMNotes = new Set<string>();

    // First pass: Map samples that have clear pattern matches
    availableSamples.forEach(sample => {
      const gmNote = mapSampleToGMNote(sample);
      if (gmNote && !usedGMNotes.has(gmNote)) {
        this.gmNoteToSampleMap.set(gmNote, sample);
        this.sampleToGMNoteMap.set(sample, gmNote);
        usedGMNotes.add(gmNote);
      }
    });

    // Second pass: Assign remaining samples to unused GM notes
    let noteIndex = 0;
    availableSamples.forEach(sample => {
      if (!this.sampleToGMNoteMap.has(sample)) {
        // Find next unused GM note
        while (noteIndex < gmNotes.length && usedGMNotes.has(gmNotes[noteIndex])) {
          noteIndex++;
        }

        if (noteIndex < gmNotes.length) {
          const gmNote = gmNotes[noteIndex];
          this.gmNoteToSampleMap.set(gmNote, sample);
          this.sampleToGMNoteMap.set(sample, gmNote);
          usedGMNotes.add(gmNote);
          noteIndex++;
        }
      }
    });

    console.log('🥁 GM Note Mapper initialized:', {
      totalMappings: this.gmNoteToSampleMap.size,
      gmNotes: Array.from(this.gmNoteToSampleMap.keys()),
      samples: Array.from(this.gmNoteToSampleMap.values()),
    });
  }

  /**
   * Update mapping with drumpad preset assignments
   * Uses the preset's pad assignments to create a consistent mapping
   */
  updateFromPreset(padAssignments: Record<string, string>): void {
    const gmNotes = getPadNotesForPage(0);

    // Clear existing mappings
    this.gmNoteToSampleMap.clear();
    this.sampleToGMNoteMap.clear();

    // Create mappings based on pad positions
    for (let i = 0; i < 16; i++) {
      const padId = `pad-${i}`;
      const sample = padAssignments[padId];
      if (sample && i < gmNotes.length) {
        const gmNote = gmNotes[i];
        this.gmNoteToSampleMap.set(gmNote, sample);
        this.sampleToGMNoteMap.set(sample, gmNote);
      }
    }

    console.log('🥁 GM Note Mapper updated from preset:', {
      totalMappings: this.gmNoteToSampleMap.size,
      mappings: Array.from(this.gmNoteToSampleMap.entries()),
    });
  }

  /**
   * Convert a GM note to the actual sample name for playback
   */
  gmNoteToSample(gmNote: string): string | null {
    return this.gmNoteToSampleMap.get(gmNote) || null;
  }

  /**
   * Convert a sample name to its GM note equivalent
   */
  sampleToGMNote(sample: string): string | null {
    return this.sampleToGMNoteMap.get(sample) || null;
  }

  /**
   * Convert an array of notes (which could be GM notes or samples) to sample names
   * This is used for playback to ensure we always play the correct sample
   */
  notesToSamples(notes: string[]): string[] {
    return notes.map(note => {
      // If it's a GM note, convert to sample
      const sample = this.gmNoteToSample(note);
      if (sample) {
        return sample;
      }
      // Otherwise, assume it's already a sample name
      return note;
    });
  }

  /**
   * Convert an array of sample names to GM notes
   */
  samplesToGMNotes(samples: string[]): string[] {
    return samples.map(sample => {
      const gmNote = this.sampleToGMNote(sample);
      return gmNote || sample;
    });
  }

  /**
   * Check if a note is a GM percussion note
   */
  isGMNote(note: string): boolean {
    return this.gmNoteToSampleMap.has(note);
  }

  /**
   * Get all current mappings
   */
  getAllMappings(): { gmNote: string; sample: string }[] {
    return Array.from(this.gmNoteToSampleMap.entries()).map(([gmNote, sample]) => ({
      gmNote,
      sample,
    }));
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.gmNoteToSampleMap.clear();
    this.sampleToGMNoteMap.clear();
  }
}

// Export singleton instance
export const gmNoteMapper = new GMNoteMapperService();

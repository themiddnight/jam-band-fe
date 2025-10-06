import { useMemo } from "react";
import type { SequencerRow, DrumRow, NoteRow, DisplayMode } from "../types";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useDrumpadPresetsStore } from "@/features/instruments/stores/drumpadPresetsStore";
import { validatePresetAssignments } from "@/features/instruments/constants/presets/drumPresets";
import { getPadNotesForPage, mapSampleToGMNote } from "@/features/instruments/constants/generalMidiPercussion";

// Memoized chromatic notes generation - static data
const CHROMATIC_NOTES = (() => {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const notes: string[] = [];
  
  for (let octave = 1; octave <= 6; octave++) {
    for (const note of noteNames) {
      notes.push(`${note}${octave}`);
    }
  }
  
  return notes.reverse(); // Higher notes first for better display
})();

interface UseSequencerRowsProps {
  currentCategory: string;
  displayMode: DisplayMode;
  availableSamples?: string[];
  scaleNotes?: string[];
  currentSteps: Array<{ note: string; beat: number }>;
}

// Generate chromatic notes for melodic instruments
const generateChromaticNotes = (): string[] => {
  // Use the pre-computed static notes for better performance
  return CHROMATIC_NOTES;
};

// Extract note name without octave for scale checking
const getNoteNameWithoutOctave = (note: string): string => {
  return note.replace(/\d+$/, "");
};

// Check if a note is in the scale
const isNoteInScale = (note: string, scaleNotes: string[]): boolean => {
  const noteNameWithoutOctave = getNoteNameWithoutOctave(note);
  return scaleNotes.some(scaleNote => 
    getNoteNameWithoutOctave(scaleNote) === noteNameWithoutOctave
  );
};

export const useSequencerRows = ({
  currentCategory,
  displayMode,
  availableSamples = [],
  scaleNotes = [],
  currentSteps,
}: UseSequencerRowsProps): SequencerRow[] => {
  
  // Get current drumpad preset for pad assignments
  const { currentPreset } = useDrumpadPresetsStore();
  
  const rows = useMemo(() => {
    const isDrumInstrument = currentCategory === InstrumentCategory.DrumBeat;
    
    // Optimize step lookups by creating a Set for O(1) lookups
    const stepNotesSet = new Set(currentSteps.map(step => step.note));

    if (isDrumInstrument) {
      // Handle drum instruments using General MIDI note mapping
      const fallbackSamples = availableSamples.length > 0 ? availableSamples : [
        "kick", "snare", "hat_closed", "hat_open", "crash", "ride", 
        "tom_high", "tom_mid", "tom_low", "clap", "rim", "shaker"
      ];

      // Get all 16 GM notes for the first page (C1-D#2) - the most common drum sounds
      const gmNotes = getPadNotesForPage(0);
      
      // Create a map of GM notes to sample names based on current preset or smart mapping
      const noteToSampleMap = new Map<string, string>();
      
      if (displayMode === "scale_notes" && currentPreset?.padAssignments) {
        // "Only in Pad" mode: Use current drumpad assignments in pad order
        const validatedPreset = validatePresetAssignments(currentPreset, fallbackSamples);
        
        for (let i = 0; i < 16; i++) {
          const padId = `pad-${i}`;
          const assignedSample = validatedPreset.padAssignments[padId];
          if (assignedSample) {
            noteToSampleMap.set(gmNotes[i], assignedSample);
          }
        }
      } else {
        // "All Samples" and "Only Current" modes: Map samples to GM notes
        fallbackSamples.forEach(sample => {
          // Try to find a GM note match for this sample
          const gmNote = mapSampleToGMNote(sample);
          if (gmNote && !noteToSampleMap.has(gmNote)) {
            noteToSampleMap.set(gmNote, sample);
          }
        });
        
        // Fill remaining GM note slots with unmapped samples
        let sampleIndex = 0;
        for (const gmNote of gmNotes) {
          if (!noteToSampleMap.has(gmNote) && sampleIndex < fallbackSamples.length) {
            // Find next unmapped sample
            while (sampleIndex < fallbackSamples.length && 
                   Array.from(noteToSampleMap.values()).includes(fallbackSamples[sampleIndex])) {
              sampleIndex++;
            }
            if (sampleIndex < fallbackSamples.length) {
              noteToSampleMap.set(gmNote, fallbackSamples[sampleIndex]);
              sampleIndex++;
            }
          }
        }
      }

      // Create drum rows using GM notes as the primary identifier
      const drumRows: DrumRow[] = Array.from(noteToSampleMap.entries()).map(([gmNote, sampleName]) => {
        const hasSteps = stepNotesSet.has(gmNote) || stepNotesSet.has(sampleName);
        
        let visible = true;
        if (displayMode === "only_current") {
          visible = hasSteps;
        }

        return {
          sampleName: gmNote, // Use GM note as the identifier for consistency
          displayName: `${gmNote} - ${sampleName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`,
          visible,
        };
      });

      return drumRows.filter(row => row.visible);
    } else {
      // Handle melodic instruments (keyboard, guitar, bass, synth)
      const allNotes = generateChromaticNotes();
      
      const noteRows: NoteRow[] = allNotes.map(note => {
        const octave = parseInt(note.slice(-1));
        const inScale = scaleNotes.length === 0 || isNoteInScale(note, scaleNotes);
        const hasSteps = stepNotesSet.has(note);
        
        let visible = true;
        switch (displayMode) {
          case "all_notes":
            visible = true;
            break;
          case "scale_notes":
            // Show scale notes + any notes that have steps (with different styling)
            visible = inScale || hasSteps;
            break;
          case "only_current":
            visible = hasSteps;
            break;
        }

        return {
          note,
          octave,
          displayName: note,
          inScale,
          visible,
        };
      });

      return noteRows.filter(row => row.visible);
    }
  }, [currentCategory, displayMode, availableSamples, scaleNotes, currentSteps, currentPreset]);

  return rows;
};

// Helper hook for getting display mode options based on instrument type
export const useDisplayModeOptions = (currentCategory: string) => {
  const isDrumInstrument = currentCategory === InstrumentCategory.DrumBeat;

  return useMemo(() => {
    if (isDrumInstrument) {
      return [
        { value: "all_notes" as const, label: "All Samples" },
        { value: "scale_notes" as const, label: "Only in Pad" },
        { value: "only_current" as const, label: "Only Current" },
      ];
    } else {
      return [
        { value: "all_notes" as const, label: "All Notes" },
        { value: "scale_notes" as const, label: "Scale Notes" },
        { value: "only_current" as const, label: "Only Current" },
      ];
    }
  }, [isDrumInstrument]);
}; 
import { useMemo } from "react";
import type { SequencerRow, DrumRow, NoteRow, DisplayMode } from "../types";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useDrumpadPresetsStore } from "@/features/instruments/stores/drumpadPresetsStore";
import { validatePresetAssignments } from "@/features/instruments/constants/presets/drumPresets";

interface UseSequencerRowsProps {
  currentCategory: string;
  displayMode: DisplayMode;
  availableSamples?: string[];
  scaleNotes?: string[];
  currentSteps: Array<{ note: string; beat: number }>;
}

// Generate chromatic notes for melodic instruments
const generateChromaticNotes = (startOctave: number = 2, endOctave: number = 6): string[] => {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const notes: string[] = [];
  
  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (const note of noteNames) {
      notes.push(`${note}${octave}`);
    }
  }
  
  return notes.reverse(); // Higher notes first for better display
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

    if (isDrumInstrument) {
      // Handle drum instruments using current drumpad preset assignments
      const fallbackSamples = availableSamples.length > 0 ? availableSamples : [
        "kick", "snare", "hat_closed", "hat_open", "crash", "ride", 
        "tom_high", "tom_mid", "tom_low", "clap", "rim", "shaker"
      ];

      let samplesToUse: string[] = [];
      
      if (displayMode === "scale_notes" && currentPreset?.padAssignments) {
        // "Only in Pad" mode: Use current drumpad assignments in pad order
        // But first validate the preset against available samples to fix mismatches
        const validatedPreset = validatePresetAssignments(currentPreset, fallbackSamples);
        
        for (let i = 0; i < 16; i++) {
          const padId = `pad-${i}`;
          const assignedSample = validatedPreset.padAssignments[padId];
          if (assignedSample) {
            samplesToUse.push(assignedSample);
          }
        }
        // If no pad assignments or less than 16, fall back to first available samples
        if (samplesToUse.length === 0) {
          samplesToUse = fallbackSamples.slice(0, 16);
        }
      } else {
        // "All Samples" and "Only Current" modes: Use all available samples
        samplesToUse = fallbackSamples;
      }

      const drumRows: DrumRow[] = samplesToUse.map(sample => {
        const hasSteps = currentSteps.some(step => step.note === sample);
        
        let visible = true;
        if (displayMode === "only_current") {
          visible = hasSteps;
        }

        return {
          sampleName: sample,
          displayName: sample.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
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
        const hasSteps = currentSteps.some(step => step.note === note);
        
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
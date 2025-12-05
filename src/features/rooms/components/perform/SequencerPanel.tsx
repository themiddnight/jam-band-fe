import { memo } from "react";
import { StepSequencer } from "@/features/sequencer";
import { InstrumentCategory } from "@/shared/constants/instruments";

interface SequencerPanelProps {
  currentCategory: InstrumentCategory;
  availableSamples: any;
  scaleState: {
    rootNote: string;
    scale: any;
    getScaleNotes: (root: string, scale: any, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  editMode: any;
  onSelectedBeatChange: (beat: number) => void;
  onEditModeChange: (mode: any) => void;
}

export const SequencerPanel = memo(({
  currentCategory,
  availableSamples,
  scaleState,
  onPlayNotes,
  onStopNotes,
  editMode,
  onSelectedBeatChange,
  onEditModeChange,
}: SequencerPanelProps) => {
  // Generate scale notes for the sequencer
  const scaleNotes = [
    ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 2),
    ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 3),
    ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 4),
    ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 5),
    ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 6),
  ];

  return (
    <div className="w-full">
      <StepSequencer
        currentCategory={currentCategory}
        availableSamples={availableSamples}
        scaleNotes={scaleNotes}
        rootNote={scaleState.rootNote}
        onPlayNotes={onPlayNotes}
        onStopNotes={onStopNotes}
        editMode={editMode}
        onSelectedBeatChange={onSelectedBeatChange}
        onEditModeChange={onEditModeChange}
      />
    </div>
  );
});

SequencerPanel.displayName = "SequencerPanel";

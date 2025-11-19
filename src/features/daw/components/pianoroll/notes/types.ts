import type { MidiNote } from '@/features/daw/types/daw';

export interface BaseNoteProps {
  note: MidiNote;
  beatWidth: number;
  isSelected: boolean;
  isDragging: boolean;
  dragOffset?: { beat: number; pitch: number };
  previewDuration?: number;
  getNoteY?: (pitch: number) => number;
  isOutOfScale?: boolean;
}

export interface NoteResizeHandleProps {
  note: MidiNote;
  beatWidth: number;
  dragOffset?: { beat: number; pitch: number };
  previewDuration?: number;
  getNoteY?: (pitch: number) => number;
}

export interface DuplicateNotePreviewProps {
  note: MidiNote;
  beatWidth: number;
  dragOffset: { beat: number; pitch: number };
  getNoteY?: (pitch: number) => number;
  isOutOfScale?: boolean;
}

export interface NoteGridBackgroundProps {
  width: number;
  height: number;
  beatWidth: number;
  totalBeats: number;
  visibleStartBeat: number;
  visibleEndBeat: number;
  gridInterval: number;
  regionHighlightStart?: number;
  regionHighlightEnd?: number;
  visibleMidiNumbers?: number[];
  midiToRowIndex?: Map<number, number>;
}

export interface MarqueeSelectionProps {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}


import { usePianoRollStore } from '../stores/pianoRollStore';
import type { MidiNote, NoteId, RegionId } from '../types/daw';

export const PianoRollService = {
  // Sync handlers
  syncAddNote: (regionId: RegionId, note: MidiNote) => 
    usePianoRollStore.getState().syncAddNote(regionId, note),
  syncUpdateNote: (regionId: RegionId, noteId: NoteId, updates: Partial<MidiNote>) => 
    usePianoRollStore.getState().syncUpdateNote(regionId, noteId, updates),
  syncDeleteNote: (regionId: RegionId, noteId: NoteId) => 
    usePianoRollStore.getState().syncDeleteNote(regionId, noteId),
};

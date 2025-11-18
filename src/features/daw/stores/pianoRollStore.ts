import { create } from 'zustand';

import { useRegionStore } from './regionStore';
import type {
  MidiNote,
  NoteId,
  RegionId,
  SustainEvent,
} from '../types/daw';

// Check if a note would overlap with any other notes at the same pitch
const checkNoteOverlap = (
  notes: MidiNote[],
  noteId: NoteId,
  newStart: number,
  duration: number,
  pitch: number
): boolean => {
  const newEnd = newStart + duration;
  return notes.some((n) => {
    if (n.id === noteId || n.pitch !== pitch) {
      return false; // Skip self and different pitches
    }
    const nEnd = n.start + n.duration;
    // Check if ranges overlap
    return !(newEnd <= n.start || newStart >= nEnd);
  });
};

interface PianoRollStoreState {
  activeRegionId: RegionId | null;
  selectedNoteIds: NoteId[];
  selectedSustainIds: string[];
  setActiveRegion: (regionId: RegionId | null) => void;
  addNote: (note: Omit<MidiNote, 'id'>) => MidiNote | null;
  updateNote: (noteId: NoteId, updates: Partial<MidiNote>) => void;
  updateNotes: (payloads: Array<{ id: NoteId; updates: Partial<MidiNote> }>) => void;
  deleteNote: (noteId: NoteId) => void;
  deleteSelectedNotes: () => void;
  setSelectedNoteIds: (noteIds: NoteId[]) => void;
  toggleNoteSelection: (noteId: NoteId) => void;
  clearSelection: () => void;
  moveNotes: (noteIds: NoteId[], deltaBeats: number, deltaPitch: number) => void;
  duplicateNotes: (noteIds: NoteId[], deltaBeats: number, deltaPitch: number) => void;
  resizeNotes: (noteIds: NoteId[], deltaBeats: number) => void;
  setNotesVelocity: (noteIds: NoteId[], velocity: number) => void;
  quantizeNotes: (noteIds: NoteId[], quantizeSize: number) => void;
  quantizeAllNotes: (quantizeSize: number) => void;
  addSustainEvent: (event: Omit<SustainEvent, 'id'>) => SustainEvent | null;
  updateSustainEvent: (eventId: string, updates: Partial<SustainEvent>) => void;
  removeSustainEvent: (eventId: string) => void;
  setSelectedSustainIds: (eventIds: string[]) => void;
  // Sync handlers (bypass undo history)
  syncAddNote: (regionId: RegionId, note: MidiNote) => void;
  syncUpdateNote: (regionId: RegionId, noteId: NoteId, updates: Partial<MidiNote>) => void;
  syncDeleteNote: (regionId: RegionId, noteId: NoteId) => void;
}

export const usePianoRollStore = create<PianoRollStoreState>((set, get) => ({
  activeRegionId: null,
  selectedNoteIds: [],
  selectedSustainIds: [],
  setActiveRegion: (regionId) => {
    set({
      activeRegionId: regionId,
      selectedNoteIds: [],
      selectedSustainIds: [],
    });
  },
  addNote: (note) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return null;
    }
    const region = useRegionStore.getState().regions.find((r) => r.id === regionId);
    if (!region || region.type !== 'midi') {
      return null;
    }
    
    // Check if new note would overlap with existing notes
    if (checkNoteOverlap(region.notes, '', note.start, note.duration, note.pitch)) {
      return null; // Don't create if it would overlap
    }
    
    const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`;
    useRegionStore.setState((state) => ({
      regions: state.regions.map((r) =>
        r.id === regionId && r.type === 'midi'
          ? {
              ...r,
              notes: [...r.notes, { ...note, id }],
            }
          : r
      ),
    }));
    return { ...note, id };
  },
  updateNote: (noteId, updates) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.map((note) =>
                note.id === noteId ? { ...note, ...updates } : note
              ),
            }
          : region
      ),
    }));
  },
  updateNotes: (payloads) => {
    const regionId = get().activeRegionId;
    if (!regionId || payloads.length === 0) {
      return;
    }
    const updatesById = payloads.reduce<Record<NoteId, Partial<MidiNote>>>(
      (acc, payload) => {
        acc[payload.id] = payload.updates;
        return acc;
      },
      {}
    );
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.map((note) =>
                updatesById[note.id] ? { ...note, ...updatesById[note.id] } : note
              ),
            }
          : region
      ),
    }));
  },
  deleteNote: (noteId) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.filter((note) => note.id !== noteId),
            }
          : region
      ),
    }));
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.filter((id) => id !== noteId),
    }));
  },
  deleteSelectedNotes: () => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    const selected = get().selectedNoteIds;
    if (!selected.length) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.filter((note) => !selected.includes(note.id)),
            }
          : region
      ),
    }));
    set({ selectedNoteIds: [] });
  },
  setSelectedNoteIds: (noteIds) =>
    set({
      selectedNoteIds: Array.from(new Set(noteIds)),
    }),
  toggleNoteSelection: (noteId) =>
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(noteId)
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    })),
  clearSelection: () =>
    set({
      selectedNoteIds: [],
      selectedSustainIds: [],
    }),
  moveNotes: (noteIds, deltaBeats, deltaPitch) => {
    if (!noteIds.length || (deltaBeats === 0 && deltaPitch === 0)) {
      return;
    }
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    const region = useRegionStore
      .getState()
      .regions.find((item) => item.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    
    // Check if any note would overlap after move
    const wouldOverlap = region.notes
      .filter((note) => noteIds.includes(note.id))
      .some((note) => {
        const newStart = Math.max(0, note.start + deltaBeats);
        const newPitch = Math.min(127, Math.max(0, note.pitch + deltaPitch));
        return checkNoteOverlap(region.notes, note.id, newStart, note.duration, newPitch);
      });
    
    // If overlap detected, don't move
    if (wouldOverlap) {
      return;
    }
    
    const updates = region.notes
      .filter((note) => noteIds.includes(note.id))
      .map((note) => ({
        id: note.id,
        updates: {
          start: Math.max(0, note.start + deltaBeats),
          pitch: Math.min(127, Math.max(0, note.pitch + deltaPitch)),
        },
      }));
    if (updates.length) {
      get().updateNotes(updates);
    }
  },
  duplicateNotes: (noteIds, deltaBeats, deltaPitch) => {
    if (!noteIds.length || (deltaBeats === 0 && deltaPitch === 0)) {
      return;
    }
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    const region = useRegionStore
      .getState()
      .regions.find((item) => item.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    
    // Check if any duplicate would overlap
    const wouldOverlap = region.notes
      .filter((note) => noteIds.includes(note.id))
      .some((note) => {
        const newStart = Math.max(0, note.start + deltaBeats);
        const newPitch = Math.min(127, Math.max(0, note.pitch + deltaPitch));
        // Use empty string as noteId since this is a new note
        return checkNoteOverlap(region.notes, '', newStart, note.duration, newPitch);
      });
    
    // If overlap detected, don't duplicate
    if (wouldOverlap) {
      return;
    }
    
    const newNoteIds: NoteId[] = [];
    region.notes
      .filter((note) => noteIds.includes(note.id))
      .forEach((note) => {
        const newNote = get().addNote({
          pitch: Math.min(127, Math.max(0, note.pitch + deltaPitch)),
          start: Math.max(0, note.start + deltaBeats),
          duration: note.duration,
          velocity: note.velocity,
        });
        if (newNote) {
          newNoteIds.push(newNote.id);
        }
      });
    if (newNoteIds.length) {
      set({ selectedNoteIds: newNoteIds });
    }
  },
  resizeNotes: (noteIds, deltaBeats) => {
    if (!noteIds.length || deltaBeats === 0) {
      return;
    }
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    const region = useRegionStore
      .getState()
      .regions.find((item) => item.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    
    // Check if any note would overlap after resize
    const wouldOverlap = region.notes
      .filter((note) => noteIds.includes(note.id))
      .some((note) => {
        const newDuration = Math.max(0.25, note.duration + deltaBeats);
        return checkNoteOverlap(region.notes, note.id, note.start, newDuration, note.pitch);
      });
    
    // If overlap detected, don't resize
    if (wouldOverlap) {
      return;
    }
    
    const updates = region.notes
      .filter((note) => noteIds.includes(note.id))
      .map((note) => ({
        id: note.id,
        updates: {
          duration: Math.max(0.25, note.duration + deltaBeats),
        },
      }));
    if (updates.length) {
      get().updateNotes(updates);
    }
  },
  setNotesVelocity: (noteIds, velocity) => {
    if (!noteIds.length) {
      return;
    }
    const clamped = Math.min(127, Math.max(0, Math.round(velocity)));
    const updates = noteIds.map((id) => ({
      id,
      updates: { velocity: clamped },
    }));
    get().updateNotes(updates);
  },
  quantizeNotes: (noteIds, quantizeSize) => {
    if (!noteIds.length) {
      return;
    }
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    
    const { regions } = useRegionStore.getState();
    const region = regions.find((r) => r.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    
    // Calculate quantize grid size in beats
    const gridSize = 4 / quantizeSize; // e.g., 4/16 = 0.25 beats for 16th notes
    
    const updates: Array<{ id: NoteId; updates: Partial<MidiNote> }> = [];
    
    noteIds.forEach((noteId) => {
      const note = region.notes.find((n) => n.id === noteId);
      if (!note) {
        return;
      }
      
      // Quantize start time to nearest grid position
      const quantizedStart = Math.round(note.start / gridSize) * gridSize;
      
      // Check if quantized position would cause overlap
      if (!checkNoteOverlap(region.notes, noteId, quantizedStart, note.duration, note.pitch)) {
        updates.push({
          id: noteId,
          updates: { start: quantizedStart },
        });
      }
    });
    
    if (updates.length > 0) {
      get().updateNotes(updates);
    }
  },
  quantizeAllNotes: (quantizeSize) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    
    const { regions } = useRegionStore.getState();
    const region = regions.find((r) => r.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    
    // Quantize all notes
    const allNoteIds = region.notes.map((n) => n.id);
    get().quantizeNotes(allNoteIds, quantizeSize);
  },
  addSustainEvent: (event) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return null;
    }
    const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`;
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              sustainEvents: [...region.sustainEvents, { ...event, id }],
            }
          : region
      ),
    }));
    return { ...event, id };
  },
  updateSustainEvent: (eventId, updates) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              sustainEvents: region.sustainEvents.map((event) =>
                event.id === eventId ? { ...event, ...updates } : event
              ),
            }
          : region
      ),
    }));
  },
  removeSustainEvent: (eventId) => {
    const regionId = get().activeRegionId;
    if (!regionId) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              sustainEvents: region.sustainEvents.filter((event) => event.id !== eventId),
            }
          : region
      ),
    }));
    set((state) => ({
      selectedSustainIds: state.selectedSustainIds.filter((id) => id !== eventId),
    }));
  },
  setSelectedSustainIds: (eventIds) =>
    set({
      selectedSustainIds: Array.from(new Set(eventIds)),
    }),
  // Sync handlers (bypass undo history - called from DAWSyncService)
  syncAddNote: (regionId, note) => {
    const region = useRegionStore.getState().regions.find((r) => r.id === regionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    // Check if note already exists
    if (region.notes.find((n) => n.id === note.id)) {
      return;
    }
    useRegionStore.setState((state) => ({
      regions: state.regions.map((r) =>
        r.id === regionId && r.type === 'midi'
          ? {
              ...r,
              notes: [...r.notes, note],
            }
          : r
      ),
    }));
  },
  syncUpdateNote: (regionId, noteId, updates) => {
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.map((note) =>
                note.id === noteId ? { ...note, ...updates } : note
              ),
            }
          : region
      ),
    }));
  },
  syncDeleteNote: (regionId, noteId) => {
    useRegionStore.setState((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId && region.type === 'midi'
          ? {
              ...region,
              notes: region.notes.filter((note) => note.id !== noteId),
            }
          : region
      ),
    }));
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.filter((id) => id !== noteId),
    }));
  },
}));


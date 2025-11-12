import { create } from 'zustand';

import { usePianoRollStore } from './pianoRollStore';
import { useRegionStore } from './regionStore';
import { useTrackStore } from './trackStore';
import type {
  Region,
  NoteId,
  RegionId,
  Track,
  TrackId,
} from '../types/daw';

const MAX_HISTORY_LENGTH = 50;

interface TrackSnapshot {
  tracks: Track[];
  selectedTrackId: TrackId | null;
}

interface RegionSnapshot {
  regions: Region[];
  selectedRegionIds: RegionId[];
  lastSelectedRegionId: RegionId | null;
}

interface PianoRollSnapshot {
  activeRegionId: RegionId | null;
  selectedNoteIds: NoteId[];
  selectedSustainIds: string[];
}

interface HistorySnapshot {
  track: TrackSnapshot;
  region: RegionSnapshot;
  pianoRoll: PianoRollSnapshot;
}

interface HistoryStoreState {
  past: HistorySnapshot[];
  present: HistorySnapshot | null;
  future: HistorySnapshot[];
  isUndoAvailable: boolean;
  isRedoAvailable: boolean;
  recordSnapshot: (snapshot?: HistorySnapshot) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const captureSnapshot = (): HistorySnapshot => {
  const trackState = useTrackStore.getState();
  const regionState = useRegionStore.getState();
  const pianoRollState = usePianoRollStore.getState();

  // Clone regions but preserve AudioBuffer references (can't be cloned)
  const clonedRegions = regionState.regions.map((region) => {
    if (region.type === 'audio') {
      const { audioBuffer, ...rest } = region;
      return {
        ...clone(rest),
        audioBuffer, // Keep original reference
        type: 'audio' as const,
      };
    }
    return clone(region);
  });

  return {
    track: clone({
      tracks: trackState.tracks,
      selectedTrackId: trackState.selectedTrackId,
    }),
    region: {
      regions: clonedRegions,
      selectedRegionIds: clone(regionState.selectedRegionIds),
      lastSelectedRegionId: regionState.lastSelectedRegionId,
    },
    pianoRoll: clone({
      activeRegionId: pianoRollState.activeRegionId,
      selectedNoteIds: pianoRollState.selectedNoteIds,
      selectedSustainIds: pianoRollState.selectedSustainIds,
    }),
  };
};

const applySnapshot = (snapshot: HistorySnapshot) => {
  useTrackStore.setState({
    tracks: clone(snapshot.track.tracks),
    selectedTrackId: snapshot.track.selectedTrackId,
  });
  
  // Restore regions but preserve AudioBuffer references
  const restoredRegions = snapshot.region.regions.map((region) => {
    if (region.type === 'audio') {
      const { audioBuffer, ...rest } = region;
      return {
        ...clone(rest),
        audioBuffer, // Keep original reference
        type: 'audio' as const,
      };
    }
    return clone(region);
  });
  
  useRegionStore.setState({
    regions: restoredRegions,
    selectedRegionIds: snapshot.region.selectedRegionIds,
    lastSelectedRegionId: snapshot.region.lastSelectedRegionId,
  });
  usePianoRollStore.setState({
    activeRegionId: snapshot.pianoRoll.activeRegionId,
    selectedNoteIds: snapshot.pianoRoll.selectedNoteIds,
    selectedSustainIds: snapshot.pianoRoll.selectedSustainIds,
  });
};

const snapshotsEqual = (a: HistorySnapshot | null, b: HistorySnapshot | null) => {
  if (!a || !b) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  past: [],
  present: null,
  future: [],
  isUndoAvailable: false,
  isRedoAvailable: false,
  recordSnapshot: (snapshot) => {
    const currentSnapshot = snapshot ?? captureSnapshot();
    const { present, past } = get();
    if (present && snapshotsEqual(present, currentSnapshot)) {
      return;
    }
    const newPast = present ? [...past, present] : [...past];
    while (newPast.length >= MAX_HISTORY_LENGTH) {
      newPast.shift();
    }
    set({
      past: newPast,
      present: currentSnapshot,
      future: [],
      isUndoAvailable: newPast.length > 0,
      isRedoAvailable: false,
    });
  },
  undo: () => {
    const { past, present, future } = get();
    if (!past.length) {
      return;
    }
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const newFuture = present ? [present, ...future] : future;
    applySnapshot(previous);
    set({
      past: newPast,
      present: previous,
      future: newFuture,
      isUndoAvailable: newPast.length > 0,
      isRedoAvailable: newFuture.length > 0,
    });
  },
  redo: () => {
    const { past, present, future } = get();
    if (!future.length) {
      return;
    }
    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = present ? [...past, present] : past;
    applySnapshot(next);
    set({
      past: newPast,
      present: next,
      future: newFuture,
      isUndoAvailable: newPast.length > 0,
      isRedoAvailable: newFuture.length > 0,
    });
  },
  clearHistory: () =>
    set({
      past: [],
      present: captureSnapshot(),
      future: [],
      isUndoAvailable: false,
      isRedoAvailable: false,
    }),
}));


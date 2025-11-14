import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  DEFAULT_BPM,
  DEFAULT_GRID_DIVISION,
  DEFAULT_TIME_SIGNATURE,
} from '../types/daw';
import type {
  LoopSettings,
  TimeSignature,
  TransportState,
} from '../types/daw';

export interface ProjectStoreState {
  bpm: number;
  timeSignature: TimeSignature;
  transportState: TransportState;
  playhead: number;
  gridDivision: number;
  loop: LoopSettings;
  isMetronomeEnabled: boolean;
  isRecording: boolean;
  snapToGrid: boolean;
  setBpm: (bpm: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setTransportState: (state: TransportState) => void;
  setPlayhead: (position: number) => void;
  setGridDivision: (division: number) => void;
  setLoop: (loop: Partial<LoopSettings>) => void;
  toggleLoop: (enabled?: boolean) => void;
  toggleMetronome: (enabled?: boolean) => void;
  toggleRecording: (enabled?: boolean) => void;
  toggleSnap: (enabled?: boolean) => void;
  reset: () => void;
}

const initialState: Omit<
  ProjectStoreState,
  'setBpm' | 'setTimeSignature' | 'setTransportState' | 'setPlayhead' | 'setGridDivision' | 'setLoop' | 'toggleLoop' | 'toggleMetronome' | 'toggleRecording' | 'toggleSnap' | 'reset'
> = {
  bpm: DEFAULT_BPM,
  timeSignature: DEFAULT_TIME_SIGNATURE,
  transportState: 'stopped',
  playhead: 0,
  gridDivision: DEFAULT_GRID_DIVISION,
  loop: {
    enabled: false,
    start: 1,
    end: 3,
  },
  isMetronomeEnabled: false,
  isRecording: false,
  snapToGrid: true,
};

type PersistedState = Pick<ProjectStoreState, 'bpm' | 'timeSignature' | 'gridDivision' | 'loop'>;

const storage =
  typeof window !== 'undefined'
    ? createJSONStorage<PersistedState>(() => window.localStorage)
    : undefined;

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setBpm: (bpm) => set({ bpm }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setTransportState: (state) =>
        set((current) => {
          const updates: Partial<ProjectStoreState> = { transportState: state };

          if ((state === 'playing' || state === 'recording') && current.loop.enabled) {
            updates.playhead = current.loop.start;
          }

          return updates;
        }),
      setPlayhead: (position) => set({ playhead: position }),
      setGridDivision: (division) => set({ gridDivision: division }),
      setLoop: (loop) =>
        set((state) => ({
          loop: {
            ...state.loop,
            ...loop,
          },
        })),
      toggleLoop: (enabled) =>
        set((state) => ({
          loop: {
            ...state.loop,
            enabled: typeof enabled === 'boolean' ? enabled : !state.loop.enabled,
          },
        })),
      toggleMetronome: (enabled) =>
        set((state) => ({
          isMetronomeEnabled:
            typeof enabled === 'boolean' ? enabled : !state.isMetronomeEnabled,
        })),
      toggleRecording: (enabled) =>
        set((state) => {
          const nextIsRecording =
            typeof enabled === 'boolean' ? enabled : !state.isRecording;

          const updates: Partial<ProjectStoreState> = {
            isRecording: nextIsRecording,
          };

          if (nextIsRecording) {
            updates.transportState = 'recording';
            if (state.loop.enabled) {
              updates.playhead = state.loop.start;
            }
          } else {
            updates.transportState =
              state.transportState === 'recording' ? 'stopped' : state.transportState;
          }

          return updates;
        }),
      toggleSnap: (enabled) =>
        set((state) => ({
          snapToGrid: typeof enabled === 'boolean' ? enabled : !state.snapToGrid,
        })),
      reset: () => set(() => ({ ...initialState })),
    }),
    {
      name: 'project-store',
      storage,
      partialize: (state) => ({
        bpm: state.bpm,
        timeSignature: state.timeSignature,
        gridDivision: state.gridDivision,
        loop: state.loop,
      }),
    }
  )
);


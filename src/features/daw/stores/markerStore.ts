import { create } from 'zustand';
import type { TimeMarker } from '../types/marker';

interface MarkerStoreState {
  markers: TimeMarker[];
  selectedMarkerId: string | null;
  isEditMode: boolean;
  
  // Regular actions (trigger undo history)
  addMarker: (marker: TimeMarker) => void;
  updateMarker: (markerId: string, updates: Partial<TimeMarker>) => void;
  removeMarker: (markerId: string) => void;
  selectMarker: (markerId: string | null) => void;
  setEditMode: (enabled: boolean) => void;
  clearMarkers: () => void;
  
  // Sync handlers (bypass undo history - called from DAWSyncService)
  syncAddMarker: (marker: TimeMarker) => void;
  syncUpdateMarker: (markerId: string, updates: Partial<TimeMarker>) => void;
  syncRemoveMarker: (markerId: string) => void;
  syncSetMarkers: (markers: TimeMarker[]) => void;
}

export const useMarkerStore = create<MarkerStoreState>((set) => ({
  markers: [],
  selectedMarkerId: null,
  isEditMode: false,
  
  // Regular actions
  addMarker: (marker) => set((state) => ({
    markers: [...state.markers, marker].sort((a, b) => a.position - b.position),
  })),
  
  updateMarker: (markerId, updates) => set((state) => ({
    markers: state.markers
      .map((m) => (m.id === markerId ? { ...m, ...updates } : m))
      .sort((a, b) => a.position - b.position),
  })),
  
  removeMarker: (markerId) => set((state) => ({
    markers: state.markers.filter((m) => m.id !== markerId),
    selectedMarkerId: state.selectedMarkerId === markerId ? null : state.selectedMarkerId,
  })),
  
  selectMarker: (markerId) => set({ selectedMarkerId: markerId }),
  
  setEditMode: (enabled) => set({ isEditMode: enabled }),
  
  clearMarkers: () => set({ markers: [], selectedMarkerId: null }),
  
  // Sync handlers (bypass undo history)
  syncAddMarker: (marker) => set((state) => {
    if (state.markers.some((m) => m.id === marker.id)) return state;
    return {
      markers: [...state.markers, marker].sort((a, b) => a.position - b.position),
    };
  }),
  
  syncUpdateMarker: (markerId, updates) => set((state) => ({
    markers: state.markers
      .map((m) => (m.id === markerId ? { ...m, ...updates } : m))
      .sort((a, b) => a.position - b.position),
  })),
  
  syncRemoveMarker: (markerId) => set((state) => ({
    markers: state.markers.filter((m) => m.id !== markerId),
    selectedMarkerId: state.selectedMarkerId === markerId ? null : state.selectedMarkerId,
  })),
  
  syncSetMarkers: (markers) => set({
    markers: markers.sort((a, b) => a.position - b.position),
  }),
}));

import { useMarkerStore } from '../stores/markerStore';
import type { TimeMarker } from '../types/marker';

export const MarkerService = {
  getMarkers: () => useMarkerStore.getState().markers,
  syncSetMarkers: (markers: TimeMarker[]) => useMarkerStore.getState().syncSetMarkers(markers),
  syncAddMarker: (marker: TimeMarker) => useMarkerStore.getState().syncAddMarker(marker),
  syncUpdateMarker: (markerId: string, updates: Partial<TimeMarker>) => 
    useMarkerStore.getState().syncUpdateMarker(markerId, updates),
  syncRemoveMarker: (markerId: string) => useMarkerStore.getState().syncRemoveMarker(markerId),
};

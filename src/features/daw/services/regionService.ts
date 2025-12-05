import { useRegionStore } from '../stores/regionStore';
import type { Region, RegionId } from '../types/daw';

/**
 * Service for interacting with the Region Store.
 * Abstracts direct Zustand store access (getState).
 */
export const RegionService = {
  // Getters
  getRegions: (): Region[] => useRegionStore.getState().regions,
  getRegion: (regionId: RegionId): Region | undefined => 
    useRegionStore.getState().regions.find((r) => r.id === regionId),
  
  // Actions
  clearSelection: () => useRegionStore.getState().clearSelection(),
  
  // Sync actions
  syncSetRegions: (regions: Region[]) => useRegionStore.getState().syncSetRegions(regions),
  syncAddRegion: (region: Region) => useRegionStore.getState().syncAddRegion(region),
  syncUpdateRegion: (regionId: RegionId, updates: Partial<Region>) => 
    useRegionStore.getState().syncUpdateRegion(regionId, updates),
  syncRemoveRegion: (regionId: RegionId) => useRegionStore.getState().syncRemoveRegion(regionId),
  syncMoveRegion: (regionId: RegionId, newStart: number) => 
    useRegionStore.getState().syncMoveRegion(regionId, newStart),
  syncSelectRegions: (regionIds: RegionId[]) => useRegionStore.getState().syncSelectRegions(regionIds),
};

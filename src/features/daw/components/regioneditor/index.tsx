import { useMemo } from 'react';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useRegionStore } from '../../stores/regionStore';
import { PianoRoll } from '../pianoroll';
import { AudioEditor } from './audioeditor';

export const RegionEditor = () => {
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const regions = useRegionStore((state) => state.regions);

  const activeRegion = useMemo(() => {
    if (!activeRegionId) return null;
    return regions.find((r) => r.id === activeRegionId) || null;
  }, [activeRegionId, regions]);

  // No region selected
  if (!activeRegion) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center bg-base-100 text-base-content/40 h-full">
        <div className="text-center">
          <p className="text-sm sm:text-base">No region selected</p>
          <p className="text-xs sm:text-sm mt-1">
            Select a region in the timeline to edit
          </p>
        </div>
      </section>
    );
  }

  // MIDI region - show Piano Roll
  if (activeRegion.type === 'midi') {
    return <PianoRoll />;
  }

  // Audio region - show Audio Editor
  if (activeRegion.type === 'audio') {
    return <AudioEditor region={activeRegion} />;
  }

  return null;
};

export default RegionEditor;


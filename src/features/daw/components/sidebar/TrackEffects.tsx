import { useEffect } from 'react';
import { EffectChain as TrackEffectChain } from '@/features/effects';
import type { EffectChainType } from '@/features/effects';
import { useEffectsStore } from '@/features/effects';
import { useTrackStore } from '@/features/daw/stores/trackStore';

export const TrackEffects = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const selectTrack = useTrackStore((state) => state.selectTrack);
  const ensureChain = useEffectsStore((state) => state.ensureChain);

  useEffect(() => {
    tracks.forEach((track) => {
      const chainType = `track:${track.id}` as EffectChainType;
      ensureChain(chainType);
    });
  }, [tracks, ensureChain]);

  return (
    <div className="flex flex-col gap-4 p-3 w-full">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
        Track Effects
      </h3>

      {tracks.length === 0 ? (
        <div className="text-center text-base-content/40 py-8">
          <p className="text-sm">No tracks yet</p>
          <p className="text-xs mt-1">Add a track to configure effects</p>
        </div>
      ) : (
        <div className="flex flex-row xl:flex-col flex-wrap gap-4 w-full">
          {tracks.map((track) => {
            const chainType = `track:${track.id}` as EffectChainType;
            const isSelected = track.id === selectedTrackId;
            const highlightClasses = isSelected
              ? 'ring-2 ring-primary/70 ring-offset-2 ring-offset-base-100'
              : 'ring-1 ring-transparent hover:ring-base-300/70';

            return (
              <button
                key={track.id}
                type="button"
                onClick={() => selectTrack(track.id)}
                className={`w-full text-left rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${highlightClasses}`}
              >
                <TrackEffectChain
                  chainType={chainType}
                  title={`${track.name} Effects`}
                  mode="arrange"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};


import { useTrackStore } from '../../stores/trackStore';
// import { useRegionStore } from '../../stores/regionStore';

export const TrackEffects = () => {
  const tracks = useTrackStore((state) => state.tracks);
  // const regions = useRegionStore((state) => state.regions);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
        Track Effects
      </h3>
      
      {tracks.length === 0 ? (
        <div className="text-center text-base-content/40 py-8">
          <p className="text-sm">No tracks yet</p>
          <p className="text-xs mt-1">Add a track to configure effects</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tracks.map((track) => {
            // const trackRegions = regions.filter((r) => r.trackId === track.id);
            
            return (
              <div
                key={track.id}
                className="rounded-lg border border-base-300 bg-base-100 p-3"
              >
                {/* Track header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: track.color }}
                  />
                  <span className="font-medium text-sm">{track.name}</span>
                  {/* <span className="badge badge-xs badge-primary">
                    {track.type === 'midi' ? 'MIDI' : 'AUDIO'}
                  </span> */}
                </div>
                
                {/* Track info */}
                {/* <div className="text-xs text-base-content/60 space-y-1 mb-3">
                  <div>Regions: {trackRegions.length}</div>
                  {track.type === 'midi' && track.instrumentId && (
                    <div className="capitalize">
                      Instrument: {track.instrumentId.replace(/-/g, ' ')}
                    </div>
                  )}
                </div> */}
                
                {/* Effects section */}
                <div className="border-t border-base-300 pt-3">
                  <h4 className="text-xs font-semibold text-base-content/70 mb-2">
                    Audio Effects
                  </h4>
                  <div className="flex flex-col items-center justify-center py-6 text-center text-base-content/30">
                    <p className="text-xs">
                      Click the button above to
                      <br />
                      configure effects for this track
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


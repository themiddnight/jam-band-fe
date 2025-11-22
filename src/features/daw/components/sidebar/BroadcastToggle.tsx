import { memo, useCallback } from 'react';
import { useBroadcastStore } from '../../stores/broadcastStore';
import { useTrackStore } from '../../stores/trackStore';

interface BroadcastToggleProps {
  onBroadcastChange?: (broadcasting: boolean, trackId: string | null) => void;
}

export const BroadcastToggle = memo(({ onBroadcastChange }: BroadcastToggleProps) => {
  const isBroadcasting = useBroadcastStore((state) => state.isBroadcasting);
  const setBroadcasting = useBroadcastStore((state) => state.setBroadcasting);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  const handleToggle = useCallback(() => {
    const newState = !isBroadcasting;
    setBroadcasting(newState);
    onBroadcastChange?.(newState, selectedTrackId);
  }, [isBroadcasting, setBroadcasting, onBroadcastChange, selectedTrackId]);

  const isDisabled = !selectedTrackId || selectedTrack?.type !== 'midi';

  return (
    <div className="card bg-base-100 shadow-lg grow">
      <div className="card-body p-3">
        <div className="flex justify-center items-center gap-3">
          <label className="label">
            <span className="text-xs">Instrument</span>
          </label>

          <button
            onClick={handleToggle}
            disabled={isDisabled}
            className={`
              btn btn-sm gap-2
              ${isBroadcasting ? 'btn-success' : 'btn-border'}
              ${isBroadcasting ? 'animate-pulse' : ''}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={
              isDisabled
                ? 'Select a MIDI track to broadcast'
                : isBroadcasting
                  ? 'Stop broadcasting your instrument'
                  : 'Broadcast your instrument to all users'
            }
          >
            <span className="text-lg">🎹</span>
            <span className="text-xs">
              {isBroadcasting ? 'Broadcasting' : 'Broadcast'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});

BroadcastToggle.displayName = 'BroadcastToggle';

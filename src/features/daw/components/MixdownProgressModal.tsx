import type { MixdownProgress } from '../hooks/useMixdown';

interface MixdownProgressModalProps {
  open: boolean;
  progress: MixdownProgress;
  onAbort: () => void;
}

export function MixdownProgressModal({
  open,
  progress,
  onAbort,
}: MixdownProgressModalProps) {
  if (!open) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Mixing Down Project</h3>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="w-full">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span className="font-mono">{Math.round(progress.percentage)}%</span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={progress.percentage}
              max="100"
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-sm">
            <span className="text-base-content/70">Time:</span>
            <span className="font-mono">
              {formatTime(progress.currentTime)} / {formatTime(progress.totalTime)}
            </span>
          </div>

          {/* Info Alert */}
          <div className="alert alert-warning">
            <div className="text-sm">
              <div className="font-semibold mb-1">⚠️ Mixdown in Progress</div>
              <div>
                The project is locked during mixdown. Please wait for the process to complete
                or click abort to cancel.
              </div>
            </div>
          </div>

          {/* Status Messages */}
          <div className="text-xs text-base-content/60 space-y-1">
            <div>• Capturing audio in real-time</div>
            <div>• Processing all tracks and effects</div>
            <div>• File will download automatically when complete</div>
          </div>
        </div>

        <div className="modal-action">
          <button
            className="btn btn-error btn-outline"
            onClick={onAbort}
          >
            Abort Mixdown
          </button>
        </div>
      </div>
    </div>
  );
}

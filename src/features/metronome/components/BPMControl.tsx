import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AnchoredPopup } from '@/features/ui';

const MIN_BPM = 40;
const MAX_BPM = 300;
const TAP_TEMPO_TIMEOUT = 2000; // Reset after 2 seconds of no taps
const MAX_TAP_COUNT = 8;

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface BPMControlProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  size?: ButtonSize;
  showLabel?: boolean;
}

export const BPMControl: React.FC<BPMControlProps> = ({
  bpm,
  onBpmChange,
  size = 'sm',
  showLabel = true,
}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [inputBpm, setInputBpm] = useState(bpm.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const bpmButtonRef = useRef<HTMLButtonElement>(null);

  // Update input when BPM changes
  useEffect(() => {
    if (!isInputFocused) {
      setInputBpm(bpm.toString());
    }
  }, [bpm, isInputFocused]);

  // Validate current input BPM
  const isValidBpm = useMemo(() => {
    const numericBpm = parseInt(inputBpm, 10);
    return (
      !isNaN(numericBpm) && numericBpm >= MIN_BPM && numericBpm <= MAX_BPM
    );
  }, [inputBpm]);

  const handleBpmChange = useCallback(
    (value: number) => {
      const clamped = Math.min(Math.max(value, MIN_BPM), MAX_BPM);
      onBpmChange(clamped);
    },
    [onBpmChange],
  );

  const handleInputBpmChange = (value: string) => {
    // Allow empty string and numeric input only
    if (value === '' || /^\d+$/.test(value)) {
      setInputBpm(value);

      // Auto-apply valid BPM changes while typing (real-time update)
      if (value !== '') {
        const numericBpm = parseInt(value, 10);
        if (
          !isNaN(numericBpm) &&
          numericBpm >= MIN_BPM &&
          numericBpm <= MAX_BPM
        ) {
          handleBpmChange(numericBpm);
        }
      }
    }
  };

  const handleInputSubmit = () => {
    const numericBpm = parseInt(inputBpm, 10);

    // If empty or invalid, reset to current BPM
    if (inputBpm === '' || isNaN(numericBpm)) {
      setInputBpm(bpm.toString());
      return;
    }

    // Clamp to valid range and apply
    const validBpm = Math.min(Math.max(numericBpm, MIN_BPM), MAX_BPM);
    handleBpmChange(validBpm);
    setInputBpm(validBpm.toString());
  };

  // Tap tempo functionality
  const handleTapTempo = useCallback(() => {
    const now = Date.now();

    setTapTimes((prev) => {
      const newTaps = [...prev, now];

      // Limit to MAX_TAP_COUNT taps
      if (newTaps.length > MAX_TAP_COUNT) {
        newTaps.shift();
      }

      // Calculate BPM if we have at least 2 taps
      if (newTaps.length >= 2) {
        const intervals = [];
        for (let i = 1; i < newTaps.length; i++) {
          intervals.push(newTaps[i] - newTaps[i - 1]);
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBpm = Math.round(60000 / avgInterval);

        // Only apply if within valid range
        if (calculatedBpm >= MIN_BPM && calculatedBpm <= MAX_BPM) {
          handleBpmChange(calculatedBpm);
        }
      }

      return newTaps;
    });

    // Reset tap timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      setTapTimes([]);
    }, TAP_TEMPO_TIMEOUT);
  }, [handleBpmChange]);

  const resetTapTempo = useCallback(() => {
    setTapTimes([]);
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const tapCount = tapTimes.length;
  const canTap = tapCount < MAX_TAP_COUNT;

  const formatBpm = (value: number) => {
    return value.toFixed(0);
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {showLabel && (
        <label className="text-xs uppercase tracking-wide text-base-content/70 hidden sm:inline">
          BPM
        </label>
      )}

      {/* BPM Display Button */}
      <button
        ref={bpmButtonRef}
        onClick={() => setIsPopupOpen(true)}
        className={`btn btn-${size} btn-info gap-1`}
        title="Click to set BPM"
      >
        <span className="text-xs opacity-75">♩</span>
        <span>{formatBpm(bpm)}</span>
      </button>

      {/* BPM Settings Popup */}
      <AnchoredPopup
        open={isPopupOpen}
        onClose={() => {
          setIsPopupOpen(false);
          resetTapTempo();
        }}
        anchorRef={bpmButtonRef}
        placement="bottom"
        className="card bg-base-100 shadow-lg border border-base-300 min-w-[200px]"
      >
        <div className="card-body p-4 space-y-4">
          {/* Manual BPM Input */}
          <div>
            <div className="flex flex-col gap-1 mb-3">
              <p className="text-xs">BPM</p>
              <p className="text-xs text-info/70">Syncs to all users in room</p>
            </div>
            <div className="join w-full">
              <button
                onClick={() => {
                  const currentBpm = parseInt(inputBpm, 10) || bpm;
                  const newBpm = Math.max(MIN_BPM, currentBpm - 1);
                  handleInputBpmChange(newBpm.toString());
                }}
                disabled={parseInt(inputBpm, 10) <= MIN_BPM}
                className="btn btn-sm join-item"
                title="Decrease BPM by 1"
              >
                −
              </button>
              <input
                type="number"
                min={MIN_BPM}
                max={MAX_BPM}
                value={inputBpm}
                onChange={(e) => handleInputBpmChange(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  setIsInputFocused(false);
                  handleInputSubmit();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleInputSubmit();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`input input-sm join-item flex-1 ${
                  inputBpm === '' || !isValidBpm ? 'input-error' : 'input-base'
                }`}
                placeholder={`${MIN_BPM}-${MAX_BPM}`}
              />
              <button
                onClick={() => {
                  const currentBpm = parseInt(inputBpm, 10) || bpm;
                  const newBpm = Math.min(MAX_BPM, currentBpm + 1);
                  handleInputBpmChange(newBpm.toString());
                }}
                disabled={parseInt(inputBpm, 10) >= MAX_BPM}
                className="btn btn-sm join-item"
                title="Increase BPM by 1"
              >
                +
              </button>
            </div>
            {inputBpm !== '' && !isValidBpm && (
              <div className="label">
                <span className="label-text-alt text-error">
                  Must be between {MIN_BPM} and {MAX_BPM}
                </span>
              </div>
            )}
          </div>

          {/* Tap Tempo */}
          <div>
            <div className="label">
              <span className="label-text text-xs">
                Tap Tempo {tapCount > 0 && `(${tapCount} taps)`}
              </span>
            </div>
            <div className="join w-full">
              <button
                onClick={handleTapTempo}
                disabled={!canTap}
                className={`btn join-item flex-1 ${canTap ? 'btn-info' : 'btn-disabled'}`}
              >
                Tap
              </button>
              <button
                onClick={resetTapTempo}
                disabled={tapCount === 0}
                className={`btn btn-square join-item ${tapCount > 0 ? 'btn-ghost' : 'btn-disabled'}`}
                title="Reset taps"
              >
                ↻
              </button>
            </div>
            {tapCount > 0 && (
              <div className="label">
                <span className="label-text-alt text-base-content/70">
                  Keep tapping to refine tempo
                </span>
              </div>
            )}
          </div>
        </div>
      </AnchoredPopup>
    </div>
  );
};

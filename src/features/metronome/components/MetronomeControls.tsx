import { METRONOME_CONFIG } from "../constants";
import { useMetronome } from "../hooks/useMetronome";
import { formatBpm, validateBpm } from "../utils";
import { AnchoredPopup } from "@/features/ui";
import React, { useState } from "react";
import { Socket } from "socket.io-client";

interface MetronomeControlsProps {
  socket: Socket | null;
  canEdit: boolean; // Whether user can edit metronome (room owner or band member)
}

export const MetronomeControls: React.FC<MetronomeControlsProps> = ({
  socket,
  canEdit,
}) => {
  const {
    bpm,
    isMuted,
    volume,
    isOnBeat,
    handleBpmChange,
    handleToggleMute,
    handleVolumeChange,
    handleTapTempo,
    resetTapTempo,
    getTapCount,
  } = useMetronome({ socket, canEdit });

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [inputBpm, setInputBpm] = useState(bpm.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);

  const bpmButtonRef = React.useRef<HTMLButtonElement>(null);

  // Update input when BPM changes from socket
  React.useEffect(() => {
    if (!isInputFocused) {
      setInputBpm(bpm.toString());
    }
  }, [bpm, isInputFocused]);

  // Validate current input BPM
  const isValidBpm = React.useMemo(() => {
    const numericBpm = parseInt(inputBpm, 10);
    return (
      !isNaN(numericBpm) &&
      numericBpm >= METRONOME_CONFIG.MIN_BPM &&
      numericBpm <= METRONOME_CONFIG.MAX_BPM
    );
  }, [inputBpm]);

  const handleInputBpmChange = (value: string) => {
    // Allow empty string and numeric input only
    if (value === "" || /^\d+$/.test(value)) {
      setInputBpm(value);

      // Auto-apply valid BPM changes while typing (real-time update)
      if (value !== "" && canEdit) {
        const numericBpm = parseInt(value, 10);
        if (
          !isNaN(numericBpm) &&
          numericBpm >= METRONOME_CONFIG.MIN_BPM &&
          numericBpm <= METRONOME_CONFIG.MAX_BPM
        ) {
          handleBpmChange(numericBpm);
        }
      }
    }
  };

  const handleInputSubmit = () => {
    if (!canEdit) return;

    const numericBpm = parseInt(inputBpm, 10);

    // If empty or invalid, reset to current BPM
    if (inputBpm === "" || isNaN(numericBpm)) {
      setInputBpm(bpm.toString());
      return;
    }

    // Clamp to valid range and apply
    const validBpm = validateBpm(numericBpm);
    handleBpmChange(validBpm);
    setInputBpm(validBpm.toString());
  };

  const tapCount = getTapCount();
  const canTap = canEdit && tapCount < 8;

  return (
    <div className="card bg-base-100 shadow-lg grow">
      <div className="card-body p-3">
        <div className="flex justify-center items-center gap-3">
          <label className="label py-1 hidden lg:block">
            <span className="label-text text-xs">Metronome</span>
          </label>
          {/* BPM Display/Input */}
          <button
            ref={bpmButtonRef}
            onClick={() => setIsPopupOpen(true)}
            disabled={!canEdit}
            className={`btn btn-sm gap-1 ${canEdit ? "btn-info" : "btn-disabled"}`}
            title={
              canEdit
                ? "Click to set BPM"
                : "Only room owner and band members can edit metronome"
            }
          >
            <span className="text-xs opacity-75">♩</span>
            <span>{formatBpm(bpm)}</span>
          </button>

          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`btn btn-soft btn-sm btn-square ${isMuted ? "btn-ghost" : "btn-info"}`}
            title={
              isMuted
                ? "Unmute metronome (personal)"
                : "Mute metronome (personal)"
            }
          >
            {isMuted ? "🔇" : "🔊"}
          </button>

          {/* Volume Slider */}
          <div className="flex items-center gap-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-base-300 rounded-lg appearance-none slider"
              title="Volume (personal setting)"
            />
          </div>

          {/* Beat indicator */}
          <div
            className={`w-2 h-2 rounded-full transition-all duration-75 ${
              isOnBeat
                ? "bg-primary scale-110 shadow-lg shadow-primary/50"
                : "bg-primary/60 scale-100"
            }`}
            title="Beat indicator"
          />

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
                  <p className="text-xs">
                    BPM
                    {/* ({METRONOME_CONFIG.MIN_BPM}-{METRONOME_CONFIG.MAX_BPM}) */}
                  </p>
                  <p className="text-xs text-warning/70">
                    Syncs to all users in room
                  </p>
                </div>
                <div className="join w-full">
                  <button
                    onClick={() => {
                      const currentBpm = parseInt(inputBpm, 10) || bpm;
                      const newBpm = Math.max(
                        METRONOME_CONFIG.MIN_BPM,
                        currentBpm - 1,
                      );
                      handleInputBpmChange(newBpm.toString());
                    }}
                    disabled={
                      !canEdit ||
                      parseInt(inputBpm, 10) <= METRONOME_CONFIG.MIN_BPM
                    }
                    className="btn btn-sm join-item"
                    title="Decrease BPM by 1"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={METRONOME_CONFIG.MIN_BPM}
                    max={METRONOME_CONFIG.MAX_BPM}
                    value={inputBpm}
                    onChange={(e) => handleInputBpmChange(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => {
                      setIsInputFocused(false);
                      handleInputSubmit();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleInputSubmit();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className={`input input-sm join-item flex-1 ${
                      !canEdit
                        ? "input-disabled"
                        : inputBpm === "" || !isValidBpm
                          ? "input-error"
                          : "input-base"
                    }`}
                    disabled={!canEdit}
                    placeholder={`${METRONOME_CONFIG.MIN_BPM}-${METRONOME_CONFIG.MAX_BPM}`}
                  />
                  <button
                    onClick={() => {
                      const currentBpm = parseInt(inputBpm, 10) || bpm;
                      const newBpm = Math.min(
                        METRONOME_CONFIG.MAX_BPM,
                        currentBpm + 1,
                      );
                      handleInputBpmChange(newBpm.toString());
                    }}
                    disabled={
                      !canEdit ||
                      parseInt(inputBpm, 10) >= METRONOME_CONFIG.MAX_BPM
                    }
                    className="btn btn-sm join-item"
                    title="Increase BPM by 1"
                  >
                    +
                  </button>
                </div>
                {canEdit && inputBpm !== "" && !isValidBpm && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      Must be between {METRONOME_CONFIG.MIN_BPM} and{" "}
                      {METRONOME_CONFIG.MAX_BPM}
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
                    className={`btn join-item flex-1 ${canTap ? "btn-info" : "btn-disabled"}`}
                  >
                    Tap
                  </button>
                  <button
                    onClick={resetTapTempo}
                    disabled={tapCount === 0}
                    className={`btn btn-square join-item ${tapCount > 0 ? "btn-ghost" : "btn-disabled"}`}
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

              {/* Permission notice */}
              {!canEdit && (
                <div className="alert alert-warning">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L5.732 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span className="text-xs">
                    Only room owner and band members can change tempo
                  </span>
                </div>
              )}
            </div>
          </AnchoredPopup>
        </div>
      </div>
    </div>
  );
};

import { memo, useMemo } from "react";
import { Socket } from "socket.io-client";
import { useSequencer } from "../hooks/useSequencer";
import {
  useSequencerRows,
  useDisplayModeOptions,
} from "../hooks/useSequencerRows";
import { StepGrid } from "./StepGrid";
import { SEQUENCER_CONSTANTS, SEQUENCER_SPEEDS } from "@/shared/constants";
import type { DisplayMode } from "../types";
import type { UseInstrumentManagerReturn } from "@/features/instruments/hooks/useInstrumentManager";

interface StepSequencerProps {
  socket: Socket | null;
  currentCategory: string;
  availableSamples?: string[];
  scaleNotes?: string[];
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  instrumentManager?: UseInstrumentManagerReturn;
}

export const StepSequencer = memo(
  ({
    socket,
    currentCategory,
    availableSamples = [],
    scaleNotes = [],
    onPlayNotes,
    onStopNotes,
    instrumentManager,
  }: StepSequencerProps) => {
    const sequencer = useSequencer({
      socket,
      currentCategory,
      onPlayNotes,
      onStopNotes,
    });

    const {
      isInitialized,
      error,
      settings,
      banks,
      currentBank,
      currentBeat,
      isPlaying,
      isPaused,
      isRecording,
      softStopRequested,
      waitingForMetronome,
      waitingBankChange,
    } = sequencer;

    // Get current bank steps for row calculation
    const currentBankSteps = useMemo(() => {
      const bank = banks[currentBank];
      return bank?.steps || [];
    }, [banks, currentBank]);

    // Transform steps for useSequencerRows
    const currentSteps = useMemo(
      () =>
        currentBankSteps.map((step) => ({ note: step.note, beat: step.beat })),
      [currentBankSteps]
    );

    // Get rows based on current display mode and instrument
    const rows = useSequencerRows({
      currentCategory,
      displayMode: settings.displayMode,
      availableSamples,
      scaleNotes,
      currentSteps,
    });

    // Get display mode options for this instrument type
    const displayModeOptions = useDisplayModeOptions(currentCategory);

    // Get playback button text and style
    const getPlaybackButtonInfo = () => {
      if (waitingForMetronome) {
        return { text: "⏳", style: "btn-warning loading", disabled: true };
      }
      if (isPlaying) {
        if (softStopRequested) {
          return { text: "⏳", style: "btn-warning", disabled: false };
        }
        return { text: "⏹", style: "btn-secondary", disabled: false };
      }
      if (isPaused) {
        return { text: "▶", style: "btn-primary", disabled: false };
      }
      return { text: "▶", style: "btn-primary", disabled: false };
    };

    const playbackInfo = getPlaybackButtonInfo();

    const handlePlayPause = () => {
      if (isPlaying) {
        if (softStopRequested) {
          sequencer.handleCancelSoftStop();
        } else {
          sequencer.handleSoftStop();
        }
      } else {
        sequencer.handlePlay();
      }
    };

    const getCurrentSpeedLabel = () => {
      const speedConfig = SEQUENCER_SPEEDS.find(
        (s) => s.value === settings.speed
      );
      return speedConfig?.label || settings.speed.toString();
    };

    // Show error state
    if (error) {
      return (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title text-error">Sequencer Error</h3>
            <p className="text-base-content/70">{error}</p>
            <div className="card-actions justify-end">
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Show loading state
    if (!isInitialized) {
      return (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-center py-8">
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <span className="ml-3 text-base-content/70">
                Initializing sequencer...
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="collapse collapse-arrow bg-base-100 shadow-lg">
        <input type="checkbox" id="step-sequencer" name="step-sequencer" />
        
        {/* First Row: Title */}
        <h3 className="collapse-title font-bold">Step Sequencer</h3>

        <div className="collapse-content space-y-4 overflow-hidden">
          {/* Second Row: Play/Stop/Rec - Speed Select - Bank Mode <---> Bank Selector */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Playback Controls */}
              <div className="flex items-center gap-1">
                <button
                  className={`btn btn-sm ${playbackInfo.style}`}
                  onClick={handlePlayPause}
                  disabled={playbackInfo.disabled}
                  title={
                    waitingForMetronome
                      ? "Waiting for metronome..."
                      : isPlaying
                        ? softStopRequested
                          ? "Click to cancel soft-stop"
                          : "Soft Stop (wait for sequence end)"
                        : "Play"
                  }
                >
                  {playbackInfo.text}
                </button>

                <button
                  className="btn btn-sm btn-outline"
                  onClick={sequencer.handleHardStop}
                  disabled={!isPlaying && !isPaused}
                  title="Hard Stop (immediate stop with note-off)"
                >
                  ⏹
                </button>

                <button
                  className={`btn btn-sm ${isRecording ? "btn-error" : "btn-outline"}`}
                  onClick={sequencer.handleToggleRecording}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? "●" : "○"}
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-base-content/70">Speed:</span>
                <div className="dropdown dropdown-end">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-sm btn-outline"
                  >
                    {getCurrentSpeedLabel()}
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 max-h-40 overflow-y-auto"
                  >
                    {SEQUENCER_SPEEDS.map(({ value, label }) => (
                      <li key={value}>
                        <button
                          className={`text-sm ${settings.speed === value ? "bg-primary/50" : ""}`}
                          onClick={() => sequencer.handleSpeedChange(value)}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bank Mode */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-base-content/70">Loop Mode:</span>
                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${settings.bankMode === "single"
                        ? "btn-primary"
                        : "btn-outline"
                      }`}
                    onClick={() => sequencer.handleBankModeChange("single")}
                  >
                    Single
                  </button>
                  <button
                    className={`btn btn-sm join-item ${settings.bankMode === "continuous"
                        ? "btn-primary"
                        : "btn-outline"
                      }`}
                    onClick={() => sequencer.handleBankModeChange("continuous")}
                  >
                    Continuous
                  </button>
                </div>
              </div>
            </div>

            {/* Bank Selector */}
            <div className="join flex-wrap">
              {SEQUENCER_CONSTANTS.BANK_NAMES.map((bankName) => (
                <button
                  key={bankName}
                  className={`btn btn-sm join-item touch-manipulation ${bankName === currentBank
                      ? waitingBankChange === bankName
                        ? "btn-warning loading animate-pulse"
                        : "btn-primary"
                      : waitingBankChange === bankName
                        ? "btn-outline btn-warning animate-pulse"
                        : banks[bankName]?.enabled
                          ? "btn-outline btn-primary"
                          : "btn-outline text-base-content/50"
                    }`}
                  onClick={() => sequencer.handleBankSwitch(bankName)}
                  title={`Bank ${bankName} (${banks[bankName]?.steps?.length || 0} steps)${!banks[bankName]?.enabled ? " - Disabled" : ""
                    }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={banks[bankName]?.enabled || false}
                      onChange={(e) => {
                        e.stopPropagation();
                        sequencer.handleBankToggleEnabled(bankName);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>Bank {bankName}</span>
                    <kbd className="kbd kbd-xs">
                      {SEQUENCER_CONSTANTS.BANK_SHORTCUTS
                        ? Object.entries(SEQUENCER_CONSTANTS.BANK_SHORTCUTS).find(
                          ([, v]) => v === bankName
                        )?.[0]
                        : ""}
                    </kbd>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Third Section: Sequencer */}
          <div className="bg-neutral p-4 rounded-lg overflow-auto">
            <StepGrid
              rows={rows}
              currentBeat={currentBeat}
              sequenceLength={settings.length}
              isRecording={isRecording}
              editMode={settings.editMode}
              onStepToggle={sequencer.handleStepToggle}
              onBeatSelect={(beat) => sequencer.setCurrentBeat(beat)}
              hasStepAt={sequencer.hasStepAt}
              getStepData={(beat, note) => {
                const steps = sequencer.getBeatSteps(beat);
                return steps.find((step) => step.note === note) || null;
              }}
              onUpdateStep={(beat, note, updates) => {
                sequencer.updateStep(beat, note, updates);
              }}
              onPlayNotes={onPlayNotes}
              onStopNotes={onStopNotes}
            />
          </div>

          {/* Fourth Section: Beat Length Slider - display mode - edit mode - Clear Bank Buttons */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Length Control */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-base-content/70 whitespace-nowrap">
                Length: {settings.length} beats
              </span>
              <input
                type="range"
                min={SEQUENCER_CONSTANTS.MIN_BEATS}
                max={SEQUENCER_CONSTANTS.MAX_BEATS}
                value={settings.length}
                onChange={(e) =>
                  sequencer.handleLengthChange(parseInt(e.target.value))
                }
                className="range range-sm range-primary flex-1 max-w-xs"
              />
              <div className="flex gap-1 text-xs text-base-content/50">
                <span>{SEQUENCER_CONSTANTS.MIN_BEATS}</span>
                <span>-</span>
                <span>{SEQUENCER_CONSTANTS.MAX_BEATS}</span>
              </div>
            </div>

            {/* Display Mode */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-base-content/70">Display:</span>
              <select
                className="select select-sm select-bordered"
                value={settings.displayMode}
                onChange={(e) =>
                  sequencer.handleDisplayModeChange(
                    e.target.value as DisplayMode
                  )
                }
              >
                {displayModeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Edit Mode */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-base-content/70">Edit:</span>
              <div className="join">
                <button
                  className={`btn btn-sm join-item ${settings.editMode === "note" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => sequencer.handleEditModeChange("note")}
                  title="Note Mode - Toggle notes on/off"
                >
                  📝
                </button>
                <button
                  className={`btn btn-sm join-item ${settings.editMode === "gate" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => sequencer.handleEditModeChange("gate")}
                  title="Gate Mode - Adjust note length (drag left-right)"
                >
                  ⏱️
                </button>
                <button
                  className={`btn btn-sm join-item ${settings.editMode === "velocity" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => sequencer.handleEditModeChange("velocity")}
                  title="Velocity Mode - Adjust note volume (drag up-down)"
                >
                  🔊
                </button>
              </div>
            </div>

            {/* Clear Bank and Copy/Paste Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="join">
                <button
                  className="btn btn-sm join-item btn-outline btn-info"
                  onClick={() => sequencer.copyBank(currentBank)}
                  title={`Copy Bank ${currentBank} patterns`}
                >
                  📋 Copy
                </button>
                <button
                  className="btn btn-sm join-item btn-outline btn-success"
                  onClick={() => sequencer.pasteBank(currentBank)}
                  title={`Paste copied patterns to Bank ${currentBank}`}
                >
                  📄 Paste
                </button>
              </div>

              <div className="divider divider-horizontal !w-0"></div>

              <button
                className="btn btn-xs btn-outline btn-error"
                onClick={sequencer.handleClearBank}
                title={`Clear Bank ${currentBank}`}
              >
                Clear
              </button>
              {instrumentManager && (
                <button
                  className="btn btn-xs btn-outline btn-warning"
                  onClick={() => {
                    console.log("🆘 Emergency cleanup triggered from sequencer UI");
                    instrumentManager.emergencyCleanup();
                  }}
                  title="Emergency cleanup - fixes stuck sounds"
                >
                  🆘 Fix Stuck
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StepSequencer.displayName = "StepSequencer";

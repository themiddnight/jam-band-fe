import { memo, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useSequencer } from "../hooks/useSequencer";
import {
  useSequencerRows,
  useDisplayModeOptions,
} from "../hooks/useSequencerRows";
import { StepGrid } from "./StepGrid";
import { useTouchEvents } from "@/features/ui";
import { SEQUENCER_CONSTANTS, SEQUENCER_SPEEDS } from "@/shared/constants";
import type { DisplayMode, EditMode } from "../types";
import type { CSSProperties } from "react";

interface StepSequencerProps {
  socket: Socket | null;
  currentCategory: string;
  availableSamples?: string[];
  scaleNotes?: string[];
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  // UI state managed by parent component
  editMode: EditMode;
  onSelectedBeatChange: (beat: number) => void;
  onEditModeChange: (mode: EditMode) => void;
}

export const StepSequencer = memo(
  ({
    socket,
    currentCategory,
    availableSamples = [],
    scaleNotes = [],
    onPlayNotes,
    onStopNotes,
    editMode,
    onSelectedBeatChange,
    onEditModeChange,
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

    // Memoized functions to prevent unnecessary re-renders in StepGrid
    const getStepDataMemo = useCallback((beat: number, note: string) => {
      const steps = sequencer.getBeatSteps(beat);
      return steps.find((step) => step.note === note) || null;
    }, [sequencer]);

    const onUpdateStepMemo = useCallback((beat: number, note: string, updates: any) => {
      sequencer.updateStep(beat, note, updates);
    }, [sequencer]);

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

    // Touch handlers for mobile optimization
    const playButtonTouchHandlers = useTouchEvents({
      onPress: handlePlayPause,
      onRelease: () => {},
      isPlayButton: true
    });

    const hardStopTouchHandlers = useTouchEvents({
      onPress: sequencer.handleHardStop,
      onRelease: () => {},
      isPlayButton: true
    });

    const recordTouchHandlers = useTouchEvents({
      onPress: sequencer.handleToggleRecording,
      onRelease: () => {},
      isPlayButton: true
    });

    // Bank mode touch handlers
    const singleModeTouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankModeChange("single"),
      onRelease: () => {},
      isPlayButton: true
    });

    const continuousModeTouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankModeChange("continuous"),
      onRelease: () => {},
      isPlayButton: true
    });

    // Edit mode touch handlers
    const noteModeTouchHandlers = useTouchEvents({
      onPress: () => onEditModeChange("note"),
      onRelease: () => {},
      isPlayButton: true
    });

    const gateModeTouchHandlers = useTouchEvents({
      onPress: () => onEditModeChange("gate"),
      onRelease: () => {},
      isPlayButton: true
    });

    const velocityModeTouchHandlers = useTouchEvents({
      onPress: () => onEditModeChange("velocity"),
      onRelease: () => {},
      isPlayButton: true
    });

    // Copy/Paste/Clear touch handlers
    const copyTouchHandlers = useTouchEvents({
      onPress: () => sequencer.copyBank(currentBank),
      onRelease: () => {},
      isPlayButton: true
    });

    const pasteTouchHandlers = useTouchEvents({
      onPress: () => sequencer.pasteBank(currentBank),
      onRelease: () => {},
      isPlayButton: true
    });

    const clearTouchHandlers = useTouchEvents({
      onPress: sequencer.handleClearBank,
      onRelease: () => {},
      isPlayButton: true
    });

    // Bank switch touch handlers - Create individual hooks to avoid calling hooks in callbacks
    const bankATouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankSwitch("A"),
      onRelease: () => {},
      isPlayButton: true
    });
    
    const bankBTouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankSwitch("B"),
      onRelease: () => {},
      isPlayButton: true
    });
    
    const bankCTouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankSwitch("C"),
      onRelease: () => {},
      isPlayButton: true
    });
    
    const bankDTouchHandlers = useTouchEvents({
      onPress: () => sequencer.handleBankSwitch("D"),
      onRelease: () => {},
      isPlayButton: true
    });

    // Map bank names to their touch handlers
    const bankTouchHandlers = {
      A: bankATouchHandlers,
      B: bankBTouchHandlers,
      C: bankCTouchHandlers,
      D: bankDTouchHandlers,
    };

    const getCurrentSpeedLabel = () => {
      const speedConfig = SEQUENCER_SPEEDS.find(
        (s) => s.value === settings.speed
      );
      return speedConfig?.label || settings.speed.toString();
    };

    // Common button styles for mobile optimization
    const mobileButtonStyle: CSSProperties = {
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent",
      WebkitTouchCallout: "none" as const,
      WebkitUserSelect: "none",
      userSelect: "none",
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
                className="btn btn-primary touch-manipulation"
                onClick={() => window.location.reload()}
                style={mobileButtonStyle}
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
        <h3 className="collapse-title font-bold">
          {isPlaying && !softStopRequested && (
            <span className="mr-2 text-primary animate-pulse">▶</span>
          )}
          Step Sequencer
        </h3>

        <div className="collapse-content space-y-4 overflow-hidden">
          {/* Second Row: Play/Stop/Rec - Speed Select - Bank Mode <---> Bank Selector */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Playback Controls */}
              <div className="flex items-center gap-1">
                <button
                  className={`btn btn-sm ${playbackInfo.style} touch-manipulation`}
                  onMouseDown={handlePlayPause}
                  ref={playButtonTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  disabled={playbackInfo.disabled}
                  style={mobileButtonStyle}
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
                  className="btn btn-sm btn-outline touch-manipulation"
                  onMouseDown={sequencer.handleHardStop}
                  ref={hardStopTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  disabled={!isPlaying && !isPaused}
                  style={mobileButtonStyle}
                  title="Hard Stop (immediate stop with note-off)"
                >
                  ⏹
                </button>

                <button
                  className={`btn btn-sm touch-manipulation ${isRecording ? "btn-error" : "btn-outline"}`}
                  onMouseDown={sequencer.handleToggleRecording}
                  ref={recordTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? "●" : "○"}
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-base-content/70">Speed:</span>
                <div className="dropdown dropdown-end">
                  <button
                    tabIndex={0}
                    role="button"
                    className="btn btn-sm btn-outline touch-manipulation"
                    style={mobileButtonStyle}
                  >
                    {getCurrentSpeedLabel()}
                  </button>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 max-h-40 overflow-y-auto"
                  >
                    {SEQUENCER_SPEEDS.map(({ value, label }) => (
                      <li key={value}>
                        <button
                          className={`text-sm touch-manipulation ${settings.speed === value ? "bg-primary/50" : ""}`}
                          onClick={() => sequencer.handleSpeedChange(value)}
                          style={mobileButtonStyle}
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
                    className={`btn btn-sm join-item touch-manipulation ${settings.bankMode === "single"
                        ? "btn-primary"
                        : "btn-outline"
                      }`}
                    onMouseDown={() => sequencer.handleBankModeChange("single")}
                    ref={singleModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                    style={mobileButtonStyle}
                  >
                    Single
                  </button>
                  <button
                    className={`btn btn-sm join-item touch-manipulation ${settings.bankMode === "continuous"
                        ? "btn-primary"
                        : "btn-outline"
                      }`}
                    onMouseDown={() => sequencer.handleBankModeChange("continuous")}
                    ref={continuousModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                    style={mobileButtonStyle}
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
                  onMouseDown={() => sequencer.handleBankSwitch(bankName)}
                  ref={bankTouchHandlers[bankName].ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
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
              editMode={editMode}
              onStepToggle={sequencer.handleStepToggle}
              onBeatSelect={onSelectedBeatChange}
              hasStepAt={sequencer.hasStepAt}
              getStepData={getStepDataMemo}
              onUpdateStep={onUpdateStepMemo}
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
                style={{ touchAction: "manipulation" }}
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
                className="select select-sm select-bordered touch-manipulation"
                value={settings.displayMode}
                onChange={(e) =>
                  sequencer.handleDisplayModeChange(
                    e.target.value as DisplayMode
                  )
                }
                style={mobileButtonStyle}
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
                  className={`btn btn-sm join-item touch-manipulation ${editMode === "note" ? "btn-primary" : "btn-outline"}`}
                  onMouseDown={() => onEditModeChange("note")}
                  ref={noteModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
                  title="Note Mode - Toggle notes on/off"
                >
                  📝
                </button>
                <button
                  className={`btn btn-sm join-item touch-manipulation ${editMode === "gate" ? "btn-primary" : "btn-outline"}`}
                  onMouseDown={() => onEditModeChange("gate")}
                  ref={gateModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
                  title="Gate Mode - Adjust note length (drag left-right)"
                >
                  ⏱️
                </button>
                <button
                  className={`btn btn-sm join-item touch-manipulation ${editMode === "velocity" ? "btn-primary" : "btn-outline"}`}
                  onMouseDown={() => onEditModeChange("velocity")}
                  ref={velocityModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
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
                  className="btn btn-sm join-item btn-outline btn-info touch-manipulation"
                  onMouseDown={() => sequencer.copyBank(currentBank)}
                  ref={copyTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
                  title={`Copy Bank ${currentBank} patterns`}
                >
                  📋 Copy
                </button>
                <button
                  className="btn btn-sm join-item btn-outline btn-success touch-manipulation"
                  onMouseDown={() => sequencer.pasteBank(currentBank)}
                  ref={pasteTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                  style={mobileButtonStyle}
                  title={`Paste copied patterns to Bank ${currentBank}`}
                >
                  📄 Paste
                </button>
              </div>

              <div className="divider divider-horizontal !w-0"></div>

              <button
                className="btn btn-xs btn-outline btn-error touch-manipulation"
                onMouseDown={sequencer.handleClearBank}
                ref={clearTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
                style={mobileButtonStyle}
                title={`Clear Bank ${currentBank}`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StepSequencer.displayName = "StepSequencer";

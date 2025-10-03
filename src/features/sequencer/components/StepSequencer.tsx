import { memo, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useSequencer } from "../hooks/useSequencer";
import { useSequencerStore } from "../stores/sequencerStore";
import {
  useSequencerRows,
  useDisplayModeOptions,
} from "../hooks/useSequencerRows";
import { VirtualizedStepGrid } from "./VirtualizedStepGrid";
import {
  PlaybackControls,
  SpeedControl,
  BankModeControl,
  BankSelector,
  EditModeControl,
  BankActions,
  LengthControl,
  DisplayModeControl,
} from "./controls";
import { PresetManager } from "@/shared/components";
import type { EditMode } from "../types";
import type { CSSProperties } from "react";

interface StepSequencerProps {
  socket: Socket | null;
  currentCategory: string;
  availableSamples?: string[];
  scaleNotes?: string[];
  rootNote?: string;
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
    rootNote,
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
    const getStepDataMemo = useCallback(
      (beat: number, note: string) => {
        const steps = sequencer.getBeatSteps(beat);
        return steps.find((step) => step.note === note) || null;
      },
      [sequencer]
    );

    const onUpdateStepMemo = useCallback(
      (beat: number, note: string, updates: any) => {
        sequencer.updateStep(beat, note, updates);
      },
      [sequencer]
    );

    // Get display mode options for this instrument type
    const displayModeOptions = useDisplayModeOptions(currentCategory);

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
              <PlaybackControls
                isPlaying={isPlaying}
                isPaused={isPaused}
                isRecording={isRecording}
                softStopRequested={softStopRequested}
                waitingForMetronome={waitingForMetronome}
                onPlayPause={handlePlayPause}
                onHardStop={sequencer.handleHardStop}
                onToggleRecording={sequencer.handleToggleRecording}
              />

              {/* Speed Control */}
              <SpeedControl
                currentSpeed={settings.speed}
                onSpeedChange={sequencer.handleSpeedChange}
              />

              {/* Bank Mode */}
              <BankModeControl
                currentMode={settings.bankMode}
                onModeChange={sequencer.handleBankModeChange}
              />
            </div>

            {/* Bank Selector */}
            <BankSelector
              banks={banks}
              currentBank={currentBank}
              waitingBankChange={waitingBankChange}
              onBankSwitch={sequencer.handleBankSwitch}
              onBankToggleEnabled={sequencer.handleBankToggleEnabled}
            />
          </div>

          {/* Preset Controls */}
          <div className="flex items-center justify-end">
            <PresetManager
              storageKey="sequencer-presets"
              version="1.0.0"
              filterPresets={(preset: any) => {
                // Group melodic and synthesizer presets together, separate drums
                const isDrumPreset = preset.instrumentCategory === 'drum_beat';
                const isCurrentDrum = currentCategory === 'drum_beat';
                
                if (isDrumPreset) {
                  return isCurrentDrum; // Only show drum presets when in drum mode
                } else {
                  return !isCurrentDrum; // Show melodic/synth presets when in melodic/synth mode
                }
              }}
              onSave={(partialPreset) => {
                const state = useSequencerStore.getState();
                return {
                  ...partialPreset,
                  banks: state.banks,
                  settings: state.settings,
                  instrumentCategory: currentCategory,
                } as any;
              }}
              onLoad={(preset: any) => {
                // Apply the preset's banks and settings directly to the store
                useSequencerStore.setState({
                  banks: preset.banks,
                  settings: preset.settings,
                  currentBeat: 0,
                  selectedBeat: 0,
                });
              }}
              size="xs"
            />
          </div>

          {/* Third Section: Sequencer */}
          <div className="bg-neutral p-4 rounded-lg overflow-x-auto overflow-y-hidden ">
            <VirtualizedStepGrid
              rows={rows}
              currentBeat={currentBeat}
              sequenceLength={settings.length}
              isRecording={isRecording}
              editMode={editMode}
              rootNote={rootNote}
              onStepToggle={sequencer.handleStepToggle}
              onBeatSelect={onSelectedBeatChange}
              onCurrentBeatChange={sequencer.setCurrentBeat}
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
            <LengthControl
              currentLength={settings.length}
              onLengthChange={sequencer.handleLengthChange}
            />

            {/* Display Mode */}
            <DisplayModeControl
              currentMode={settings.displayMode}
              options={displayModeOptions}
              onModeChange={sequencer.handleDisplayModeChange}
            />

            {/* Edit Mode */}
            <EditModeControl
              currentMode={editMode}
              onModeChange={onEditModeChange}
            />

            {/* Clear Bank and Copy/Paste Buttons */}
            <BankActions
              currentBank={currentBank}
              onCopyBank={sequencer.copyBank}
              onPasteBank={sequencer.pasteBank}
              onClearBank={sequencer.handleClearBank}
            />
          </div>
        </div>
      </div>
    );
  }
);

StepSequencer.displayName = "StepSequencer";

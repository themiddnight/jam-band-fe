import { memo, useMemo, useCallback, useState, useEffect } from "react";
import { useSequencer } from "../hooks/useSequencer";
import { useSequencerStore } from "../stores/sequencerStore";
import { DEFAULT_MELODIC_PRESETS } from "../constants/defaultPresets";
import { DEFAULT_DRUM_BEAT_PRESETS } from "../constants/defaultDrumPresets";
import {
  useSequencerRows,
  useDisplayModeOptions,
} from "../hooks/useSequencerRows";
import { KonvaStepGrid } from "./konva";
import {
  PlaybackControls,
  SpeedControl,
  BankModeControl,
  BankSelector,
  EditModeControl,
  BankActions,
  LengthControl,
  DisplayModeControl,
  SelectModeControls,
} from "./controls";
import { PresetManager } from "@/shared/components";
import type { EditMode, SequencerStep } from "../types";
import type { CSSProperties } from "react";
import { AiGenerationPopup } from "../../ai/components/AiGenerationPopup";
import type { AiNote } from "../../../shared/api/aiGeneration";
import { Frequency } from "tone";
import { getAiSettings } from "../../../shared/api/aiSettings";

interface StepSequencerProps {
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

    const isCollapsed = useSequencerStore((state) => state.isCollapsed);
    const setIsCollapsed = useSequencerStore((state) => state.setIsCollapsed);

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

    // Selection state for select mode
    const [selectMode, setSelectMode] = useState(false);
    const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());

    // AI enabled state
    const [isAiEnabled, setIsAiEnabled] = useState(false);

    // Check if AI is enabled
    useEffect(() => {
      getAiSettings()
        .then(({ settings }) => {
          setIsAiEnabled(settings.enabled && settings.hasApiKey);
        })
        .catch(() => {
          setIsAiEnabled(false);
        });
    }, []);

    // Handle updating selected steps (gate/velocity)
    const handleUpdateSelectedSteps = useCallback((updates: Partial<SequencerStep>) => {
      selectedSteps.forEach((stepKey) => {
        const [beat, note] = stepKey.split('-');
        sequencer.updateStep(parseInt(beat), note, updates);
      });
    }, [selectedSteps, sequencer]);

    // Clear selection when switching modes
    const handleSelectModeChange = useCallback((enabled: boolean) => {
      setSelectMode(enabled);
      if (!enabled) {
        setSelectedSteps(new Set());
      }
    }, []);

    // AI Context
    const aiContext = useMemo(() => {
      const context: any = {
        bpm: sequencer.currentBPM,
        scale: {
          rootNote: rootNote || 'C',
          scale: currentCategory === 'drum_beat' ? 'Drum' : 'Major'
        },
        instrument: {
          name: currentCategory,
          category: currentCategory
        },
        loopLength: settings.length / 4
      };

      // Add existing notes to context if any
      if (currentBankSteps.length > 0) {
        context.existingNotes = currentBankSteps.map(step => ({
          pitch: Frequency(step.note).toMidi(),
          start: step.beat / 4,
          duration: (step.gate || 1) / 4,
          velocity: Math.round((step.velocity || 0.8) * 127)
        }));
      }

      return context;
    }, [sequencer.currentBPM, rootNote, currentCategory, settings.length, currentBankSteps]);

    // Handle AI Generation
    const handleAiGenerate = useCallback((notes: AiNote[]) => {
      sequencer.handleClearBank();

      notes.forEach(note => {
        const noteName = Frequency(note.pitch, "midi").toNote();
        const stepIndex = Math.round(note.start * 4);

        if (stepIndex >= 0 && stepIndex < settings.length) {
          sequencer.handleStepAdd(
            stepIndex,
            noteName,
            Math.min(1, note.velocity / 127),
            Math.max(1, Math.round(note.duration * 4))
          );
        }
      });
    }, [sequencer, settings.length]);

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

    // Handle arrow key navigation in recording mode
    useEffect(() => {
      if (!isRecording) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle arrow keys when in recording mode
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // Prevent default scrolling behavior
          e.preventDefault();

          const newBeat = e.key === 'ArrowLeft'
            ? Math.max(0, currentBeat - 1)
            : Math.min(settings.length - 1, currentBeat + 1);

          sequencer.setCurrentBeat(newBeat);
          onSelectedBeatChange(newBeat);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording, currentBeat, settings.length, sequencer, onSelectedBeatChange]);

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
      <div className={`collapse collapse-arrow bg-base-100 shadow-lg ${!isCollapsed ? 'collapse-open' : 'collapse-close'}`}>
        <input
          type="checkbox"
          id="step-sequencer"
          name="step-sequencer"
          checked={!isCollapsed}
          onChange={() => setIsCollapsed(!isCollapsed)}
        />

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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {/* AI Generation */}
              <AiGenerationPopup
                onGenerate={handleAiGenerate}
                context={aiContext}
                trigger={
                  <button 
                    className="btn btn-xs btn-secondary btn-outline gap-2"
                    disabled={!isAiEnabled}
                    title={!isAiEnabled ? "Enable AI Features in Account Settings" : "AI Composer"}
                  >
                    <span>✨</span> AI
                  </button>
                }
              />

              {/* Select Mode Toggle and Sliders */}
              <SelectModeControls
                selectMode={selectMode}
                onSelectModeChange={handleSelectModeChange}
                selectedSteps={selectedSteps}
                onUpdateSelectedSteps={handleUpdateSelectedSteps}
                getStepData={getStepDataMemo}
              />
            </div>

            <PresetManager
              storageKey="sequencer-presets"
              version="1.0.0"
              backendType="SEQUENCER"
              additionalPresets={currentCategory === 'drum_beat' ? DEFAULT_DRUM_BEAT_PRESETS : DEFAULT_MELODIC_PRESETS}
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
                // Apply the preset's banks and settings, preserving current UI state
                const currentState = useSequencerStore.getState();
                useSequencerStore.setState({
                  banks: preset.banks,
                  settings: {
                    ...preset.settings,
                    // Preserve current UI state (displayMode and editMode)
                    displayMode: currentState.settings.displayMode,
                    editMode: currentState.settings.editMode,
                  },
                  currentBeat: 0,
                  selectedBeat: 0,
                });
              }}
              size="xs"
            />
          </div>

          {/* Third Section: Sequencer */}
          <div className="bg-neutral py-4 pr-4 rounded-lg overflow-y-hidden">
            <KonvaStepGrid
              rows={rows}
              currentBeat={currentBeat}
              sequenceLength={settings.length}
              isRecording={isRecording}
              editMode={editMode}
              rootNote={rootNote}
              selectMode={selectMode}
              selectedSteps={selectedSteps}
              onSelectionChange={setSelectedSteps}
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

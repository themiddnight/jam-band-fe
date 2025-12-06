import { MidiStatus } from "@/features/audio";
import { VoiceInput } from "@/features/audio";
import {
  InstrumentCategorySelector,
  InstrumentMute,
} from "@/features/instruments";
import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
  LazySynthControlsWrapper as SynthControls,
} from "@/features/instruments";
import { MetronomeControls } from "@/features/metronome";
// import { StepSequencer } from "@/features/sequencer"; // Removed
import { SequencerPanel } from "./SequencerPanel";
import { ScaleSlots } from "@/features/ui";
import { EffectsChainSection } from "@/features/effects";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { ControlType } from "@/shared/types";
import type { Room, RoomUser } from "@/shared/types";
import { memo } from 'react';

interface InstrumentStageProps {
  currentUser: RoomUser | null;
  currentRoom: Room | null;
  isConnected: boolean;
  
  // MIDI Controller
  midiController: {
    isConnected: boolean;
    getMidiInputs: () => any[];
    requestMidiAccess: () => Promise<boolean>;
    connectionError: string | null; // or undefined? MidiStatus uses optional string | null
    isRequesting: boolean;
    refreshMidiDevices: () => boolean;
  };

  // Voice
  isVoiceEnabled: boolean;
  canTransmitVoice: boolean;
  localStream: MediaStream | null;
  handleStreamReady: (stream: MediaStream) => void;
  handleStreamRemoved: () => void;
  currentLatency: number | undefined;
  rtcLatencyActive: boolean;
  browserAudioLatency: number | null;
  meshLatency: number | null;
  isConnecting: boolean;
  error: string | null;

  // Instrument State
  isInstrumentMuted: boolean;
  setInstrumentMuted: (muted: boolean) => void;

  // Scale
  scaleState: {
    rootNote: string;
    scale: any;
    getScaleNotes: (root: string, scale: any, octave: number) => string[];
    setRootNote: (note: string) => void;
    setScale: (scale: any) => void;
  };
  handleRoomOwnerScaleChange: (rootNote: string, scale: any) => void;
  handleToggleFollowRoomOwner: (follow: boolean) => void;

  // Instrument Selection
  currentCategory: InstrumentCategory;
  currentInstrument: string;
  handleCategoryChange: (category: string) => void;
  handleInstrumentChange: (instrument: string) => void;
  isLoadingInstrument: boolean;
  dynamicDrumMachines: any[];

  // Sequencer
  availableSamples: any;
  handlePlayNotesWithRecording: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  handleStopNotesWrapper: (notes: string[]) => void;
  settings: any;
  setSelectedBeat: (beat: number) => void;
  setEditMode: (mode: any) => void;

  // Synth
  synthState: any;
  updateSynthParams: (params: any) => void;
  loadPresetParams: (presetId: string) => void;
  isSynthesizerLoaded: boolean;

  // Audio Context
  isAudioContextReady: boolean;
  needsUserGesture: boolean;
  initializeAudioContext: () => void;
  getCurrentInstrumentControlType: () => ControlType;

  // Instrument Handlers (passed to specific instruments)
  commonProps: any;
}

export const InstrumentStage = memo(({
  currentUser,
  currentRoom,
  midiController,
  isVoiceEnabled,
  canTransmitVoice,
  handleStreamReady,
  handleStreamRemoved,
  currentLatency,
  rtcLatencyActive,
  browserAudioLatency,
  meshLatency,
  isConnecting,
  error,
  isInstrumentMuted,
  setInstrumentMuted,
  scaleState,
  handleRoomOwnerScaleChange,
  handleToggleFollowRoomOwner,
  currentCategory,
  currentInstrument,
  handleCategoryChange,
  handleInstrumentChange,
  isLoadingInstrument,
  dynamicDrumMachines,
  availableSamples,
  handlePlayNotesWithRecording,
  handleStopNotesWrapper,
  settings,
  setSelectedBeat,
  setEditMode,
  synthState,
  updateSynthParams,
  loadPresetParams,
  isSynthesizerLoaded,
  isAudioContextReady,
  needsUserGesture,
  initializeAudioContext,
  getCurrentInstrumentControlType,
  commonProps,
}: InstrumentStageProps) => {

  const renderInstrumentControl = () => {
    const controlType = getCurrentInstrumentControlType();

    // Show loading indicator while audio context is initializing
    if (!isAudioContextReady) {
      // If user gesture is needed, show initialization button
      if (needsUserGesture) {
        return (
          <div className="card bg-base-100 shadow-xl w-full">
            <div className="card-body text-center">
              <h3 className="card-title justify-center text-xl">
                Audio Setup Required
              </h3>
              <p className="text-base-content/70 mt-4">
                Click the button below to initialize the audio system for your
                jam session.
              </p>
              <div className="card-actions justify-center mt-6">
                <button
                  onClick={initializeAudioContext}
                  className="btn btn-primary btn-lg"
                >
                  Initialize Audio
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Otherwise show loading spinner
      return (
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Initializing Audio...
            </h3>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <p className="text-base-content/70 mt-4">
              Setting up audio system for the jam session...
            </p>
          </div>
        </div>
      );
    }

    // Show loading indicator
    if (
      isLoadingInstrument ||
      (currentCategory === InstrumentCategory.Synthesizer &&
        !isSynthesizerLoaded)
    ) {
      return (
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Loading Instrument...
            </h3>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <p className="text-base-content/70 mt-4">
              Please wait while we load the instrument samples...
            </p>
          </div>
        </div>
      );
    }

    switch (controlType) {
      case ControlType.Keyboard:
        return <Keyboard {...commonProps} />;
      case ControlType.Guitar:
        return <Guitar {...commonProps} />;
      case ControlType.Bass:
        return <Bass {...commonProps} />;
      case ControlType.Drumpad:
        return (
          <Drumpad
            {...commonProps}
            availableSamples={availableSamples}
            dynamicDrumMachines={dynamicDrumMachines}
            currentInstrument={currentInstrument}
          />
        );
      case ControlType.Drumset:
        return (
          <Drumset
            {...commonProps}
            availableSamples={availableSamples}
            dynamicDrumMachines={dynamicDrumMachines}
            currentInstrument={currentInstrument}
          />
        );
      default:
        return <div>Unknown Instrument Type</div>;
    }
  };

  return (
    <div className="flex gap-2 flex-wrap w-full mb-3">
      {/* Instrument Controls */}
      {(currentUser?.role === "room_owner" ||
        currentUser?.role === "band_member") && (
          <MidiStatus
            isConnected={midiController.isConnected}
            getMidiInputs={midiController.getMidiInputs}
            onRequestAccess={midiController.requestMidiAccess}
            connectionError={midiController.connectionError}
            isRequesting={midiController.isRequesting}
            refreshMidiDevices={midiController.refreshMidiDevices}
          />
        )}

      {/* Voice Communication - Only for users who can transmit */}
      {isVoiceEnabled && canTransmitVoice && (
        <VoiceInput
          isVisible={isVoiceEnabled}
          onStreamReady={handleStreamReady}
          onStreamRemoved={handleStreamRemoved}
          rtcLatency={currentLatency ?? undefined}
          rtcLatencyActive={rtcLatencyActive}
          userCount={currentRoom?.users?.length || 0}
          browserAudioLatency={browserAudioLatency ?? undefined}
          meshLatency={meshLatency ?? undefined}
          isConnecting={isConnecting}
          connectionError={!!error}
          onConnectionRetry={() => window.location.reload()}
        />
      )}

      {/* Instrument Controls */}
      {(currentUser?.role === "room_owner" ||
        currentUser?.role === "band_member") && (
          <>
            {/* Virtual Instrument Mute Control */}
            <InstrumentMute
              isMuted={isInstrumentMuted}
              onMuteChange={setInstrumentMuted}
            />

            {/* Metronome Controls */}
            <MetronomeControls
              canEdit={
                currentUser?.role === "room_owner" ||
                currentUser?.role === "band_member"
              }
            />

            <ScaleSlots
              onSlotSelect={(rootNote, scale) => {
                scaleState.setRootNote(rootNote);
                scaleState.setScale(scale);

                // If user is room owner, broadcast the scale change
                if (currentUser?.role === "room_owner") {
                  handleRoomOwnerScaleChange(rootNote, scale);
                }
              }}
              currentUser={currentUser}
              isRoomOwner={currentUser?.role === "room_owner"}
              followRoomOwner={currentUser?.followRoomOwner || false}
              onToggleFollowRoomOwner={handleToggleFollowRoomOwner}
              disabled={currentUser?.followRoomOwner || false}
              ownerScale={currentRoom?.ownerScale}
            />

            <InstrumentCategorySelector
              currentCategory={currentCategory}
              currentInstrument={currentInstrument}
              onCategoryChange={handleCategoryChange}
              onInstrumentChange={handleInstrumentChange}
              isLoading={isLoadingInstrument}
              dynamicDrumMachines={dynamicDrumMachines}
            />

            {/* Step Sequencer */}
            <SequencerPanel
              currentCategory={currentCategory}
              availableSamples={availableSamples}
              scaleState={scaleState}
              onPlayNotes={handlePlayNotesWithRecording}
              onStopNotes={handleStopNotesWrapper}
              editMode={settings.editMode}
              onSelectedBeatChange={setSelectedBeat}
              onEditModeChange={setEditMode}
            />

            {/* Synthesizer Controls */}
            {currentCategory === InstrumentCategory.Synthesizer &&
              synthState && (
                <div className="w-full">
                  <SynthControls
                    currentInstrument={currentInstrument}
                    synthState={synthState}
                    onParamChange={updateSynthParams}
                    onLoadPreset={loadPresetParams}
                  />
                </div>
              )}

            {/* Instrument Interface */}
            {renderInstrumentControl()}

            {/* Effects Chain Section */}
            <div className="w-full">
              <EffectsChainSection />
            </div>
          </>
        )}
    </div>
  );
});

InstrumentStage.displayName = "InstrumentStage";

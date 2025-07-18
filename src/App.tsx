import { useRef, useEffect, useCallback } from "react";
import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
  LazySynthControlsWrapper as SynthControls,
} from "./components/LazyComponents";
import ScaleSelector from "./components/ScaleSelector";
import InstrumentCategorySelector from "./components/InstrumentCategorySelector";
import MidiStatus from "./components/MidiStatus";
import { useScaleState } from "./hooks/useScaleState";
import { useMidiController } from "./hooks/useMidiController";
import { useInstrument } from "./hooks/useInstrument";
import { ControlType } from "./types";
import { InstrumentCategory } from "./constants/instruments";
import { preloadCriticalComponents, preloadInstrumentComponents } from "./utils/componentPreloader";
import "./utils/midiTest"; // Import MIDI test utility

export default function App() {
  const scaleState = useScaleState();
  const {
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
    initializeAudioContext,
    playNotes,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    handleMidiNoteOn,
    handleMidiNoteOff,
    handleMidiControlChange,
    handleMidiSustainChange,
    // Synthesizer-specific properties
    synthState,
    updateSynthParams,
    loadPresetParams,
    isSynthesizerLoaded,
  } = useInstrument();

  // Memoize MIDI handlers to prevent unnecessary recreation
  const midiHandlers = useRef({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
    onControlChange: handleMidiControlChange,
    onSustainChange: handleMidiSustainChange,
  });

  // Update handlers ref when they change
  useEffect(() => {
    midiHandlers.current = {
      onNoteOn: handleMidiNoteOn,
      onNoteOff: handleMidiNoteOff,
      onControlChange: handleMidiControlChange,
      onSustainChange: handleMidiSustainChange,
    };
  }, [
    handleMidiNoteOn,
    handleMidiNoteOff,
    handleMidiControlChange,
    handleMidiSustainChange,
  ]);

  // Create stable callback functions
  const stableMidiHandlers = {
    onNoteOn: useCallback((note: number, velocity: number) => {
      midiHandlers.current.onNoteOn(note, velocity);
    }, []),
    onNoteOff: useCallback((note: number) => {
      midiHandlers.current.onNoteOff(note);
    }, []),
    onControlChange: useCallback((controller: number) => {
      midiHandlers.current.onControlChange(controller);
    }, []),
    onPitchBend: useCallback(() => null, []),
    onSustainChange: useCallback((sustain: boolean) => {
      midiHandlers.current.onSustainChange(sustain);
    }, []),
  };

  // Initialize MIDI controller with stable handlers
  const midiController = useMidiController(stableMidiHandlers);

  const handleInitializeAudio = async () => {
    try {
      await initializeAudioContext();
      // The instrument will be loaded automatically when AudioContext becomes ready
      
      // Preload critical components after audio is initialized
      preloadCriticalComponents();
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
    }
  };

  // Preload instrument components when category changes
  useEffect(() => {
    if (currentCategory) {
      const instrumentType = getCurrentInstrumentControlType();
      if (instrumentType) {
        preloadInstrumentComponents(instrumentType.toLowerCase());
      }
    }
  }, [currentCategory, getCurrentInstrumentControlType]);

  const renderInstrumentControl = () => {
    const controlType = getCurrentInstrumentControlType();
    const commonProps = {
      scaleState: {
        rootNote: scaleState.rootNote,
        scale: scaleState.scale,
        getScaleNotes: scaleState.getScaleNotes,
      },
      onPlayNotes: playNotes,
      onStopNotes: stopNotes,
      onStopSustainedNotes: stopSustainedNotes,
      onReleaseKeyHeldNote: releaseKeyHeldNote,
      onSustainChange: setSustainState,
    };

    // Show initialization button if AudioContext is not ready
    if (!isAudioContextReady) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-6xl text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Initialize Audio
          </h3>
          <p className="text-gray-600 mb-4">
            Click the button below to initialize the audio system and load the
            instrument.
          </p>
          <button
            onClick={handleInitializeAudio}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            Initialize Audio & Load Instrument
          </button>
          <p className="text-xs text-gray-500 mt-4">
            This is required due to browser autoplay policies.
          </p>
        </div>
      );
    }

    // Show loading indicator
    if (isLoadingInstrument || (currentCategory === InstrumentCategory.Synthesizer && !isSynthesizerLoaded)) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-6xl text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Loading Instrument...
          </h3>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">
            Loading {currentInstrument.replace(/_/g, " ")}...
          </p>
        </div>
      );
    }

    switch (controlType) {
      case ControlType.Guitar:
        return <Guitar {...commonProps} />;
      case ControlType.Bass:
        return <Bass {...commonProps} />;
      case ControlType.Drumpad:
        return <Drumpad {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Drumset:
        return <Drumset {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  };

  return (
    <div className="flex flex-col items-center p-3 bg-gray-100 min-h-screen">
      <div className="flex gap-3 flex-wrap w-full max-w-6xl mb-3">
        <MidiStatus
          isConnected={midiController.isConnected}
          getMidiInputs={midiController.getMidiInputs}
          onRequestAccess={midiController.requestMidiAccess}
          connectionError={midiController.connectionError}
          isRequesting={midiController.isRequesting}
        />
        <ScaleSelector
          rootNote={scaleState.rootNote}
          scale={scaleState.scale}
          onRootNoteChange={scaleState.setRootNote}
          onScaleChange={scaleState.setScale}
        />
        <InstrumentCategorySelector
          currentCategory={currentCategory}
          currentInstrument={currentInstrument}
          onCategoryChange={handleCategoryChange}
          onInstrumentChange={handleInstrumentChange}
          isLoading={isLoadingInstrument}
          dynamicDrumMachines={dynamicDrumMachines}
        />
      </div>

      {/* Show synthesizer controls only for synthesizer category */}
      {currentCategory === InstrumentCategory.Synthesizer && synthState && (
        <div className="w-full max-w-6xl mb-3">
          <SynthControls
            currentInstrument={currentInstrument}
            synthState={synthState}
            onParamChange={updateSynthParams}
            onLoadPreset={loadPresetParams}
          />
        </div>
      )}

      {renderInstrumentControl()}
    </div>
  );
}

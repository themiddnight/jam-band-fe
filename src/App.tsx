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
import {
  preloadCriticalComponents,
  preloadInstrumentComponents,
} from "./utils/componentPreloader";
import {
  initSafariCompatibility,
  isSafari,
  getSafariUserMessage,
} from "./utils/webkitCompat";
import "./utils/midiTest"; // Import MIDI test utility

export default function App() {
  // Initialize Safari compatibility on app start
  useEffect(() => {
    initSafariCompatibility();
  }, []);

  const scaleState = useScaleState();
  const {
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
    audioContextError,
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
  const onNoteOn = useCallback((note: number, velocity: number) => {
    midiHandlers.current.onNoteOn(note, velocity);
  }, []);

  const onNoteOff = useCallback((note: number) => {
    midiHandlers.current.onNoteOff(note);
  }, []);

  const onControlChange = useCallback((controller: number) => {
    midiHandlers.current.onControlChange(controller);
  }, []);

  const onPitchBend = useCallback(() => null, []);

  const onSustainChange = useCallback((sustain: boolean) => {
    midiHandlers.current.onSustainChange(sustain);
  }, []);

  // Initialize MIDI controller with stable handlers
  const midiController = useMidiController({
    onNoteOn,
    onNoteOff,
    onControlChange,
    onPitchBend,
    onSustainChange,
  });

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
      const safariDetected = isSafari();

      return (
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Initialize Audio
            </h3>
            <p className="text-base-content/70 mb-4">
              Click the button below to initialize the audio system and load the
              instrument.
            </p>

            {audioContextError && (
              <div className="alert alert-warning mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.186-.833-2.956 0L3.857 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div>
                  <h4 className="font-bold">Audio Initialization Error</h4>
                  <p className="text-sm">
                    {getSafariUserMessage(audioContextError)}
                  </p>
                  {safariDetected && (
                    <p className="text-xs mt-2">
                      Safari users: Try refreshing the page or enabling audio in
                      Safari settings.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="card-actions justify-center">
              <button
                onClick={handleInitializeAudio}
                className="btn btn-primary"
                disabled={isLoadingInstrument}
              >
                {isLoadingInstrument
                  ? "Initializing..."
                  : "Initialize Audio & Load Instrument"}
              </button>
            </div>
            <p className="text-xs text-base-content/50 mt-4">
              This is required due to browser autoplay policies.
              {safariDetected && (
                <>
                  <br />
                  Safari users may need to interact with the page first.
                </>
              )}
            </p>
          </div>
        </div>
      );
    }

    // Show loading indicator or error state
    if (
      isLoadingInstrument ||
      (currentCategory === InstrumentCategory.Synthesizer &&
        !isSynthesizerLoaded)
    ) {
      const safariLoading = isSafari();

      return (
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
          <div className="card-body text-center flex flex-col items-center">
            <h3 className="card-title justify-center text-xl">
              Loading Instrument...
            </h3>
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <p className="text-base-content/70 mt-4">
              Loading {currentInstrument.replace(/_/g, " ")}...
            </p>
            {safariLoading && (
              <p className="text-xs text-base-content/50 mt-2">
                Safari may take longer to load audio samples. If this instrument
                fails, the app will automatically try Safari-compatible
                alternatives.
              </p>
            )}
          </div>
        </div>
      );
    }

    // Show error state if there's an audio context error but we're not loading
    if (audioContextError && !isLoadingInstrument) {
      const safariError = isSafari();

      return (
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl text-error">
              Audio Error
            </h3>
            <div className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="font-bold">Instrument Loading Failed</h4>
                <p className="text-sm">
                  {getSafariUserMessage(audioContextError)}
                </p>
                {safariError && audioContextError.includes("decoding") && (
                  <p className="text-xs mt-2">
                    Safari audio decoding issue detected. This instrument may
                    not be compatible with Safari. Try switching to a different
                    instrument or refreshing the page.
                  </p>
                )}
              </div>
            </div>
            <div className="card-actions justify-center mt-4">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Refresh Page
              </button>
              <button
                onClick={handleInitializeAudio}
                className="btn btn-outline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (controlType) {
      case ControlType.Guitar:
        return <Guitar {...commonProps} />;
      case ControlType.Bass:
        return <Bass {...commonProps} />;
      case ControlType.Drumpad:
        return <Drumpad {...commonProps} availableSamples={availableSamples} currentInstrument={currentInstrument} />;
      case ControlType.Drumset:
        return <Drumset {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-3">
      <div className="flex flex-col items-center">
        <div className="flex gap-2 flex-wrap w-full max-w-6xl mb-3">
          <MidiStatus
            isConnected={midiController.isConnected}
            getMidiInputs={midiController.getMidiInputs}
            onRequestAccess={midiController.requestMidiAccess}
            connectionError={midiController.connectionError}
            isRequesting={midiController.isRequesting}
            refreshMidiDevices={midiController.refreshMidiDevices}
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
    </div>
  );
}

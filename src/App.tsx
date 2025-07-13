import { useRef, useEffect } from "react";
import Keyboard from "./components/Keyboard";
import Guitar from "./components/Guitar";
import Bass from "./components/Bass";
import Drumpad from "./components/Drumpad";
import Drumset from "./components/Drumset";
import ScaleSelector from "./components/ScaleSelector";
import InstrumentSelector from "./components/InstrumentSelector";
import MidiStatus from "./components/MidiStatus";
import { useScaleState } from "./hooks/useScaleState";
import { useMidiController } from "./hooks/useMidiController";
import { useInstrument } from "./hooks/useInstrument";
import { ControlType } from "./types";

export default function App() {
  const scaleState = useScaleState();
  const {
    instrument,
    currentInstrument,
    isLoadingInstrument,
    loadInstrument,
    playNotes,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,
    handleInstrumentChange,
    getCurrentInstrumentControlType,
    handleMidiNoteOn,
    handleMidiNoteOff,
    handleMidiControlChange,
    handleMidiSustainChange,
  } = useInstrument();

  const handlersRef = useRef({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
    onControlChange: handleMidiControlChange,
    onSustainChange: handleMidiSustainChange,
  });

  useEffect(() => {
    handlersRef.current = {
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

  // Initialize MIDI controller
  const midiController = useMidiController({
    onNoteOn: (note, velocity) => handlersRef.current.onNoteOn(note, velocity),
    onNoteOff: (note) => handlersRef.current.onNoteOff(note),
    onControlChange: (controller) =>
      handlersRef.current.onControlChange(controller),
    onPitchBend: () => null,
    onSustainChange: (sustain) => handlersRef.current.onSustainChange(sustain),
  });

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

    // Show initialization button if no instrument is loaded
    if (!instrument && !isLoadingInstrument) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Initialize Audio
          </h3>
          <p className="text-gray-600 mb-4">
            Click the button below to initialize the audio system and load the
            instrument.
          </p>
          <button
            onClick={() => {
              loadInstrument(currentInstrument);
            }}
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
    if (isLoadingInstrument) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl text-center">
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
        return <Drumpad {...commonProps} />;
      case ControlType.Drumset:
        return <Drumset {...commonProps} />;
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  };

  return (
    <div className="flex flex-col items-center p-3 bg-gray-100 min-h-screen">
      <div className="flex gap-3 flex-wrap w-full max-w-4xl mb-3">
        <ScaleSelector
          rootNote={scaleState.rootNote}
          scale={scaleState.scale}
          onRootNoteChange={scaleState.setRootNote}
          onScaleChange={scaleState.setScale}
        />
        <InstrumentSelector
          currentInstrument={currentInstrument}
          onInstrumentChange={handleInstrumentChange}
          isLoading={isLoadingInstrument}
        />
        <MidiStatus
          isConnected={midiController.isConnected}
          getMidiInputs={midiController.getMidiInputs}
          onRequestAccess={midiController.requestMidiAccess}
        />
      </div>

      {renderInstrumentControl()}
    </div>
  );
}

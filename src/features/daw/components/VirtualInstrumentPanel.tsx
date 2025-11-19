import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";

import { useProjectStore } from "../stores/projectStore";
import { useTrackStore } from "../stores/trackStore";
import { trackInstrumentRegistry } from "../utils/trackInstrumentRegistry";
import { noteNameToMidi } from "../utils/midiUtils";

import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
} from "@/features/instruments";
import type { MidiMessage } from "@/features/daw/hooks/useMidiInput";
import type { Track } from "@/features/daw/types/daw";
import {
  InstrumentCategory,
  SOUNDFONT_INSTRUMENTS,
} from "@/shared/constants/instruments";
import { ControlType } from "@/shared/types";
import { getScaleNotes } from "@/features/ui/utils/musicUtils";
import { useArrangeRoomScaleStore } from "../stores/arrangeRoomStore";

type PlayHandler = (message: MidiMessage) => void;

const VELOCITY_MIN = 1;
const VELOCITY_MAX = 127;

const clampVelocity = (velocity: number) => {
  const value = Math.round(velocity * VELOCITY_MAX);
  return Math.max(VELOCITY_MIN, Math.min(VELOCITY_MAX, value));
};

const getControlTypeForTrack = (track: Track | null): ControlType | null => {
  if (!track || track.type !== "midi") {
    return null;
  }

  if (track.instrumentCategory === InstrumentCategory.DrumBeat) {
    return ControlType.Drumpad;
  }

  if (track.instrumentCategory === InstrumentCategory.Synthesizer) {
    return ControlType.Keyboard;
  }

  const instrument = SOUNDFONT_INSTRUMENTS.find((item) => item.value === track.instrumentId);
  if (instrument?.controlType) {
    return instrument.controlType;
  }

  return ControlType.Keyboard;
};

interface VirtualInstrumentPanelProps {
  onRecordMidiMessage: PlayHandler;
}

export const VirtualInstrumentPanel = memo(({ onRecordMidiMessage }: VirtualInstrumentPanelProps) => {
  const transportState = useProjectStore((state) => state.transportState);
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);

  const selectedTrack = useMemo(() => {
    if (!selectedTrackId) return null;
    return tracks.find((track) => track.id === selectedTrackId) ?? null;
  }, [selectedTrackId, tracks]);

  const [availableSamples, setAvailableSamples] = useState<string[]>([]);
  const [isLoadingInstrument, setIsLoadingInstrument] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectionActiveRef = useRef(false);

  const controlType = useMemo(() => getControlTypeForTrack(selectedTrack), [selectedTrack]);
  const rootNote = useArrangeRoomScaleStore((state) => state.rootNote);
  const scale = useArrangeRoomScaleStore((state) => state.scale);

  const scaleState = useMemo(
    () => ({
      rootNote,
      scale,
      getScaleNotes,
    }),
    [rootNote, scale],
  );

  useEffect(() => {
    let cancelled = false;

    const prepareEngine = async () => {
      if (!selectedTrack || selectedTrack.type !== "midi") {
        setAvailableSamples([]);
        return;
      }

      setIsLoadingInstrument(true);
      setLoadError(null);

      try {
        const { engine } = await trackInstrumentRegistry.ensureEngine(selectedTrack, {
          instrumentId: selectedTrack.instrumentId,
          instrumentCategory: selectedTrack.instrumentCategory,
        });

        if (cancelled) return;

        if (selectedTrack.instrumentCategory === InstrumentCategory.DrumBeat) {
          // For drum machines, wait for samples to load
          let samples = engine.getAvailableSamples?.() ?? [];
          
          // If no samples are available yet, wait for them
          if (samples.length === 0) {
            try {
              samples = await engine.waitForSamples?.(3000) ?? [];
            } catch (error) {
              console.warn("Timeout waiting for drum samples", error);
            }
          }
          
          if (!cancelled) {
            setAvailableSamples(samples);
          }
        } else {
          setAvailableSamples([]);
        }
      } catch (error) {
        console.error("Failed to prepare instrument engine", error);
        if (!cancelled) {
          setLoadError("Unable to initialize instrument audio.");
          setAvailableSamples([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInstrument(false);
        }
      }
    };

    void prepareEngine();

    return () => {
      cancelled = true;
    };
  }, [selectedTrack?.id, selectedTrack?.instrumentId, selectedTrack?.instrumentCategory, selectedTrack]);

  const playNotes = useCallback(
    async (notes: string[], velocity: number, isKeyHeld: boolean) => {
      if (!selectedTrack || selectedTrack.type !== "midi") {
        return;
      }

      try {
        await trackInstrumentRegistry.playNotes(selectedTrack, notes, {
          velocity: Math.round(velocity * 127),
          isKeyHeld,
        });
      } catch (error) {
        console.error("Failed to play notes", error);
      }

      if (transportState !== "recording") {
        return;
      }

      notes.forEach((note) => {
        const midiNumber = noteNameToMidi(note);
        if (midiNumber === null) {
          console.warn('[Recording] Failed to convert note to MIDI', { note });
          return;
        }

        const message: MidiMessage = {
          type: "noteon",
          channel: 0,
          note: midiNumber,
          velocity: clampVelocity(velocity),
          monitoringHandled: true,
          raw: {
            data: new Uint8Array([0x90, midiNumber, clampVelocity(velocity)]),
            timeStamp: performance.now(),
          } as unknown as MIDIMessageEvent,
        };
        onRecordMidiMessage(message);

        // For one-shot drum hits (isKeyHeld = false), send note-off after a short delay
        if (!isKeyHeld && selectedTrack.instrumentCategory === InstrumentCategory.DrumBeat) {
          setTimeout(() => {
            const noteOffMessage: MidiMessage = {
              type: "noteoff",
              channel: 0,
              note: midiNumber,
              velocity: 0,
              monitoringHandled: true,
              raw: {
                data: new Uint8Array([0x80, midiNumber, 0]),
                timeStamp: performance.now(),
              } as unknown as MIDIMessageEvent,
            };
            onRecordMidiMessage(noteOffMessage);
          }, 100); // 100ms duration for drum hits
        }
      });
    },
    [selectedTrack, transportState, onRecordMidiMessage],
  );

  const stopNotes = useCallback(
    async (notes: string[]) => {
      if (!selectedTrack || selectedTrack.type !== "midi") {
        return;
      }

      try {
        await trackInstrumentRegistry.stopNotes(selectedTrack, notes);
      } catch (error) {
        console.error("Failed to stop notes", error);
      }

      if (transportState !== "recording") {
        return;
      }

      notes.forEach((note) => {
        const midiNumber = noteNameToMidi(note);
        if (midiNumber === null) {
          console.warn('[Recording] Failed to convert note to MIDI for noteoff', { note });
          return;
        }

        const message: MidiMessage = {
          type: "noteoff",
          channel: 0,
          note: midiNumber,
          velocity: 0,
          monitoringHandled: true,
          raw: {
            data: new Uint8Array([0x80, midiNumber, 0]),
            timeStamp: performance.now(),
          } as unknown as MIDIMessageEvent,
        };
        onRecordMidiMessage(message);
      });
    },
    [selectedTrack, transportState, onRecordMidiMessage],
  );

  const handleSustainChange = useCallback(
    async (sustain: boolean) => {
      if (!selectedTrack || selectedTrack.type !== "midi") {
        return;
      }

      try {
        await trackInstrumentRegistry.setSustain(selectedTrack, sustain);
      } catch (error) {
        console.error("Failed to toggle sustain", error);
      }

      if (transportState !== "recording") {
        return;
      }

      const value = sustain ? 127 : 0;
      const shouldRecordSustain = controlType === ControlType.Keyboard;
      const message: MidiMessage = {
        type: "controlchange",
        channel: 0,
        control: 64,
        value,
        raw: {
          data: new Uint8Array([0xb0, 64, value]),
          timeStamp: performance.now(),
        } as unknown as MIDIMessageEvent,
      };

      if (!shouldRecordSustain) {
        message.monitoringHandled = true;
      }

      onRecordMidiMessage(message);
    },
    [selectedTrack, transportState, onRecordMidiMessage, controlType],
  );

  const handleReleaseKeyHeldNote = useCallback(
    async (note: string) => {
      await stopNotes([note]);
    },
    [stopNotes],
  );

  const handleStopSustainedNotes = useCallback(async () => {
    await handleSustainChange(false);
  }, [handleSustainChange]);

  const sendSelectionSustain = useCallback(
    (isActive: boolean) => {
      if (transportState !== "recording" || selectionActiveRef.current === isActive) {
        selectionActiveRef.current = isActive;
        return;
      }

      selectionActiveRef.current = isActive;

      const value = isActive ? 127 : 0;
      const message: MidiMessage = {
        type: "controlchange",
        channel: 0,
        control: 64,
        value,
        monitoringHandled: true,
        raw: {
          data: new Uint8Array([0xb0, 64, value]),
          timeStamp: performance.now(),
        } as unknown as MIDIMessageEvent,
      };
      onRecordMidiMessage(message);
    },
    [onRecordMidiMessage, transportState],
  );

  const resetSelectionForRecordingStop = useCallback(() => {
    if (!selectionActiveRef.current) {
      return;
    }

    const value = 0;
    const message: MidiMessage = {
      type: "controlchange",
      channel: 0,
      control: 64,
      value,
      monitoringHandled: true,
      raw: {
        data: new Uint8Array([0xb0, 64, value]),
        timeStamp: performance.now(),
      } as unknown as MIDIMessageEvent,
    };
    selectionActiveRef.current = false;
    onRecordMidiMessage(message);
  }, [onRecordMidiMessage]);

  useEffect(() => {
    if (transportState !== "recording") {
      resetSelectionForRecordingStop();
    }
  }, [transportState, resetSelectionForRecordingStop]);

  const renderInstrument = () => {
    if (!selectedTrackId) {
      return <div className="rounded-lg bg-base-200 px-4 py-3 text-sm text-base-content/70">Select a track to play its instrument.</div>;
    }

    if (!selectedTrack || selectedTrack.type !== "midi") {
      return <div className="rounded-lg bg-base-200 px-4 py-3 text-sm text-base-content/70">Virtual instruments are only available for MIDI tracks.</div>;
    }

    if (isLoadingInstrument) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg bg-base-200 px-4 py-6 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-md mb-2" />
          Loading instrument...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="rounded-lg bg-error/10 px-4 py-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-error">{loadError}</p>
            <p className="text-xs text-base-content/60">
              Audio requires user interaction to start. Click the button below to initialize audio.
            </p>
            <button
              onClick={async () => {
                setLoadError(null);
                setIsLoadingInstrument(true);
                try {
                  // Import AudioContextManager and Tone dynamically
                  const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
                  const Tone = await import('tone');
                  
                  // Get and start the audio context
                  const context = await AudioContextManager.getInstrumentContext();
                  
                  // Ensure context is running
                  if (context.state !== 'running') {
                    await context.resume();
                  }
                  
                  // Start Tone.js transport (required for some instruments)
                  if (Tone.getContext().state !== 'running') {
                    await Tone.start();
                  }
                  
                  // Wait a bit for audio to fully initialize
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // Verify context is actually running now
                  if (context.state !== 'running') {
                    throw new Error('AudioContext failed to start. Please try clicking again.');
                  }
                  
                  // Retry loading the instrument
                  if (selectedTrack && selectedTrack.type === 'midi') {
                    const { engine } = await trackInstrumentRegistry.ensureEngine(selectedTrack, {
                      instrumentId: selectedTrack.instrumentId,
                      instrumentCategory: selectedTrack.instrumentCategory,
                    });
                    
                    if (selectedTrack.instrumentCategory === InstrumentCategory.DrumBeat) {
                      let samples = engine.getAvailableSamples?.() ?? [];
                      if (samples.length === 0) {
                        try {
                          samples = await engine.waitForSamples?.(3000) ?? [];
                        } catch (error) {
                          console.warn("Timeout waiting for drum samples", error);
                        }
                      }
                      setAvailableSamples(samples);
                    }
                  }
                } catch (error) {
                  console.error("Failed to initialize audio", error);
                  const errorMessage = error instanceof Error ? error.message : "Failed to initialize audio. Please try again.";
                  setLoadError(errorMessage);
                } finally {
                  setIsLoadingInstrument(false);
                }
              }}
              className="btn btn-sm btn-primary"
            >
              Initialize Audio
            </button>
          </div>
        </div>
      );
    }

    const commonProps = {
      scaleState,
      onPlayNotes: playNotes,
      onStopNotes: stopNotes,
      onStopSustainedNotes: handleStopSustainedNotes,
      onReleaseKeyHeldNote: handleReleaseKeyHeldNote,
      onSustainChange: handleSustainChange,
      onSustainToggleChange: handleSustainChange,
    };
    const selectionAwareProps = {
      ...commonProps,
      onSelectionActiveChange: sendSelectionSustain,
    };

    switch (controlType) {
      case ControlType.Guitar:
        return <Guitar {...selectionAwareProps} />;
      case ControlType.Bass:
        return <Bass {...selectionAwareProps} />;
      case ControlType.Drumset:
        return <Drumset {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Drumpad:
        return (
          <Drumpad
            {...commonProps}
            availableSamples={availableSamples}
            currentInstrument={selectedTrack.instrumentId ?? "drums"}
          />
        );
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-1 shadow-sm overflow-auto">
      <div className="mx-auto">
        {renderInstrument()}
      </div>
    </section>
  );
});
VirtualInstrumentPanel.displayName = 'VirtualInstrumentPanel';

export default VirtualInstrumentPanel;

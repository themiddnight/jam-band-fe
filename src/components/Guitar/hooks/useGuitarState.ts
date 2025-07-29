import { useState, useCallback } from "react";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarState, StrumConfig } from "../types/guitar";

interface UseGuitarStateProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
  onSustainToggleChange?: (sustainToggle: boolean) => void;
}

export const useGuitarState = ({
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSustainToggleChange,
}: UseGuitarStateProps) => {
  const [mode, setMode] = useState<'basic' | 'simple-note' | 'simple-chord'>('basic');
  const [velocity, setVelocity] = useState(0.5);
  const [sustain, setSustain] = useState(false);
  const [sustainToggle, setSustainToggle] = useState(false);
  const [currentOctave, setCurrentOctave] = useState(3);
  const [chordVoicing, setChordVoicing] = useState(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedNotes, setPressedNotes] = useState<Set<string>>(new Set());
  const [pressedChords, setPressedChords] = useState<Set<number>>(new Set());
  const [strumConfig, setStrumConfig] = useState<StrumConfig>({
    speed: 100, // 100ms default
    direction: 'down',
    isActive: false,
  });

  const handleSustainChange = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    onSustainChange(newSustain);
  }, [onSustainChange]);

  const handleSustainToggleChange = useCallback((newSustainToggle: boolean) => {
    setSustainToggle(newSustainToggle);
    onSustainToggleChange?.(newSustainToggle);
  }, [onSustainToggleChange]);

  const playNote = useCallback(async (note: string, customVelocity?: number) => {
    const noteVelocity = customVelocity !== undefined ? customVelocity : velocity;
    await onPlayNotes([note], noteVelocity, true);
  }, [onPlayNotes, velocity]);

  const stopNote = useCallback((note: string) => {
    onStopNotes([note]);
  }, [onStopNotes]);

  const releaseKeyHeldNote = useCallback((note: string) => {
    onReleaseKeyHeldNote(note);
  }, [onReleaseKeyHeldNote]);

  const stopSustainedNotes = useCallback(() => {
    onStopSustainedNotes();
  }, [onStopSustainedNotes]);

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, []);

  const handleOctaveChange = useCallback((newOctave: number) => {
    setCurrentOctave(newOctave);
  }, []);

  const handleChordVoicingChange = useCallback((newVoicing: number) => {
    setChordVoicing(newVoicing);
  }, []);

  const handleStrumSpeedChange = useCallback((newSpeed: number) => {
    setStrumConfig(prev => ({ ...prev, speed: newSpeed }));
  }, []);

  const handleStrumDirectionChange = useCallback((direction: 'up' | 'down') => {
    setStrumConfig(prev => ({ ...prev, direction }));
  }, []);

  const guitarState: GuitarState = {
    mode: { type: mode, description: mode },
    velocity,
    sustain,
    sustainToggle,
    currentOctave,
    chordVoicing,
    chordModifiers,
    pressedNotes,
    pressedChords,
    strumConfig,
  };

  return {
    guitarState,
    mode,
    setMode,
    velocity,
    setVelocity: handleVelocityChange,
    sustain,
    setSustain: handleSustainChange,
    sustainToggle,
    setSustainToggle: handleSustainToggleChange,
    currentOctave,
    setCurrentOctave: handleOctaveChange,
    chordVoicing,
    setChordVoicing: handleChordVoicingChange,
    chordModifiers,
    setChordModifiers,
    pressedNotes,
    setPressedNotes,
    pressedChords,
    setPressedChords,
    strumConfig,
    setStrumSpeed: handleStrumSpeedChange,
    setStrumDirection: handleStrumDirectionChange,
    playNote,
    stopNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
  };
}; 
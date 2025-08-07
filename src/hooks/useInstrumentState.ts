import { useState, useCallback, useMemo, useRef } from "react";

export interface InstrumentStateProps {
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
  onSustainToggleChange?: (sustainToggle: boolean) => void;
}

export interface InstrumentState {
  // Common state
  velocity: number;
  sustain: boolean;
  sustainToggle: boolean;
  hasSustainedNotes: boolean;
  pressedKeys: Set<string>;
  heldKeys: Set<string>;

  // Common actions
  setVelocity: (velocity: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;
  setPressedKeys: (keys: Set<string>) => void;
  setHeldKeys: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Note actions
  playNote: (
    note: string,
    velocity?: number,
    isKeyHeld?: boolean,
  ) => Promise<void>;
  stopNote: (note: string) => void;
  releaseKeyHeldNote: (note: string) => void;
  stopSustainedNotes: () => void;

  // Utility
  forceResetSustain: () => void;
}

export const useInstrumentState = (
  props: InstrumentStateProps,
): InstrumentState => {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [sustainToggle, setSustainToggle] = useState<boolean>(false);
  const [hasSustainedNotes, setHasSustainedNotes] = useState<boolean>(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());

  // Use ref to track current state for stable callbacks
  const stateRef = useRef({ sustain, sustainToggle, pressedKeys, velocity });
  stateRef.current = { sustain, sustainToggle, pressedKeys, velocity };

  // Optimized set operations for pressed keys
  const updatePressedKeys = useCallback(
    (note: string, action: "add" | "delete") => {
      setPressedKeys((prev) => {
        const hasNote = prev.has(note);
        if (action === "add" && hasNote) return prev;
        if (action === "delete" && !hasNote) return prev;

        const newSet = new Set(prev);
        if (action === "add") {
          newSet.add(note);
        } else {
          newSet.delete(note);
        }
        return newSet;
      });
    },
    [],
  );

  // Improved setSustain with better state consistency
  const setSustainWithCallback = useCallback(
    (newSustain: boolean) => {
      setSustain(newSustain);
      props.onSustainChange(newSustain);

      // If turning off sustain, stop sustained notes
      if (!newSustain) {
        setHasSustainedNotes(false);
        props.onStopSustainedNotes();
      }
    },
    [props],
  );

  const setSustainToggleWithCallback = useCallback(
    (newSustainToggle: boolean) => {
      setSustainToggle(newSustainToggle);
      if (newSustainToggle) {
        // When toggle is enabled, always activate sustain (like always pressing sustain pedal)
        setSustain(true);
        props.onSustainChange(true);
      } else {
        // When toggle is disabled, return to normal sustain behavior
        setSustain(false);
        props.onSustainChange(false);
        props.onStopSustainedNotes();
      }
      // Notify parent component of sustain toggle state change
      if (props.onSustainToggleChange) {
        props.onSustainToggleChange(newSustainToggle);
      }
    },
    [props],
  );

  const playNote = useCallback(
    async (
      note: string,
      customVelocity?: number,
      isKeyHeld: boolean = false,
    ) => {
      const noteVelocity =
        customVelocity !== undefined ? customVelocity : velocity;
      await props.onPlayNotes([note], noteVelocity, isKeyHeld);

      if (isKeyHeld) {
        updatePressedKeys(note, "add");
      }

      // When toggle is active and we play a note, it will be sustained
      // When sustain is active (either through toggle or manual press), mark as sustained
      if ((stateRef.current.sustainToggle || stateRef.current.sustain) && !isKeyHeld) {
        setHasSustainedNotes(true);
      }
    },
    [props, velocity, updatePressedKeys],
  );

  const stopNote = useCallback(
    (note: string) => {
      props.onStopNotes([note]);
      updatePressedKeys(note, "delete");
    },
    [props, updatePressedKeys],
  );

  const releaseKeyHeldNote = useCallback(
    (note: string) => {
      props.onReleaseKeyHeldNote(note);
      updatePressedKeys(note, "delete");

      // When toggle is active and we release a key, check if we should turn off sustained notes
      if (stateRef.current.sustainToggle) {
        // Use setTimeout to ensure state is updated before checking
        setTimeout(() => {
          setPressedKeys((current) => {
            if (current.size === 0) {
              setHasSustainedNotes(false);
            }
            return current;
          });
        }, 10); // Reduced timeout for better responsiveness
      }
    },
    [props, updatePressedKeys],
  );

  const stopSustainedNotes = useCallback(() => {
    props.onStopSustainedNotes();
    setHasSustainedNotes(false);

    // Don't automatically reset sustain state - let the UI controls handle it
    // This allows the sustain button behavior to work correctly in both modes
  }, [props]);

  // Add force reset mechanism for stuck states
  const forceResetSustain = useCallback(() => {
    setSustain(false);
    setSustainToggle(false);
    setHasSustainedNotes(false);
    props.onSustainChange(false);
    props.onStopSustainedNotes();
  }, [props]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      velocity,
      sustain,
      sustainToggle,
      hasSustainedNotes,
      pressedKeys,
      heldKeys,
      setVelocity,
      setSustain: setSustainWithCallback,
      setSustainToggle: setSustainToggleWithCallback,
      setPressedKeys,
      setHeldKeys, // This is already the correct React dispatch type
      playNote,
      stopNote,
      releaseKeyHeldNote,
      stopSustainedNotes,
      forceResetSustain,
    }),
    [
      velocity,
      sustain,
      sustainToggle,
      hasSustainedNotes,
      pressedKeys,
      heldKeys,
      setSustainWithCallback,
      setSustainToggleWithCallback,
      playNote,
      stopNote,
      releaseKeyHeldNote,
      stopSustainedNotes,
      forceResetSustain,
    ],
  );
};

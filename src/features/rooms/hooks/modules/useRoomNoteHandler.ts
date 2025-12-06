import { useCallback } from "react";
import { gmNoteMapper } from "@/features/instruments";
import { InstrumentCategory } from "@/shared/constants/instruments";

interface UseRoomNoteHandlerProps {
  isConnected: boolean;
  userId: string | null;
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  isInstrumentMuted: boolean;
  playLocalNote: (
    notes: string[],
    velocity: number,
    isKeyHeld?: boolean,
  ) => Promise<void>;
  stopLocalNotes: (notes: string[]) => Promise<void>;
  playNote: (data: any) => void;
  setPlayingIndicators: React.Dispatch<
    React.SetStateAction<Map<string, { velocity: number; timestamp: number }>>
  >;
  setSustainState: (sustained: boolean) => void;
}

export const useRoomNoteHandler = ({
  isConnected,
  userId,
  currentInstrument,
  currentCategory,
  playLocalNote,
  stopLocalNotes,
  playNote,
  setPlayingIndicators,
  setSustainState,
}: Omit<UseRoomNoteHandlerProps, 'isInstrumentMuted'>) => {
  // Note playing handlers
  const handlePlayNote = useCallback(
    async (
      notes: string[],
      velocity: number,
      eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off",
      isKeyHeld?: boolean,
    ) => {
      // Always play locally first
      try {
        if (eventType === "note_on") {
          await playLocalNote(notes, velocity, isKeyHeld || false);

          // Set local playing indicator immediately for local user
          if (userId) {
            setPlayingIndicators((prev) => {
              const newMap = new Map(prev);
              newMap.set(userId, {
                velocity: velocity,
                timestamp: Date.now(),
              });
              return newMap;
            });

            // Clear local playing indicator after a short delay
            setTimeout(() => {
              setPlayingIndicators((prev) => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
              });
            }, 200);
          }
        } else if (eventType === "note_off") {
          await stopLocalNotes(notes);
        }
      } catch (error) {
        console.error("❌ Failed to play locally:", error);
      }

      // Send to other users through socket if connected
      if (!isConnected) {
        console.warn("🚫 Not connected, skipping remote send");
        return;
      }

      let sampleNotes: string[] | undefined;
      if (
        eventType === "note_on" &&
        currentCategory === InstrumentCategory.DrumBeat &&
        notes.length > 0
      ) {
        sampleNotes = notes.map(
          (note) => gmNoteMapper.gmNoteToSample(note) || note,
        );
      }

      const noteData = {
        notes,
        velocity,
        instrument: currentInstrument,
        category: currentCategory,
        eventType,
        isKeyHeld,
        ...(sampleNotes ? { sampleNotes } : {}),
      };

      playNote(noteData);
    },
    [
      isConnected,
      currentInstrument,
      currentCategory,
      playNote,
      playLocalNote,
      stopLocalNotes,
      userId,
      setPlayingIndicators,
    ],
  );

  // Muted version of handlePlayNote - only plays locally, no socket messages
  const handlePlayNoteMuted = useCallback(
    async (
      notes: string[],
      velocity: number,
      eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off",
      isKeyHeld?: boolean,
    ) => {
      // Only play locally, no socket messages sent
      try {
        if (eventType === "note_on") {
          await playLocalNote(notes, velocity, isKeyHeld || false);

          // Set local playing indicator immediately for local user (visual feedback)
          if (userId) {
            setPlayingIndicators((prev) => {
              const newMap = new Map(prev);
              newMap.set(userId, {
                velocity: velocity,
                timestamp: Date.now(),
              });
              return newMap;
            });

            // Clear local playing indicator after a short delay
            setTimeout(() => {
              setPlayingIndicators((prev) => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
              });
            }, 200);
          }
        } else if (eventType === "note_off") {
          await stopLocalNotes(notes);
        }
      } catch (error) {
        console.error("❌ Failed to play locally (muted mode):", error);
      }

      // No socket messages sent in muted mode
      console.log("🔇 Instrument muted - playing locally only");
    },
    [playLocalNote, stopLocalNotes, userId, setPlayingIndicators],
  );

  // Factory function to create the appropriate play note handler based on mute state
  const createPlayNoteHandler = useCallback(
    (isMuted: boolean) => {
      return isMuted ? handlePlayNoteMuted : handlePlayNote;
    },
    [handlePlayNoteMuted, handlePlayNote],
  );

  const handleStopNote = useCallback(
    (notes: string[] | string) => {
      const notesArray = Array.isArray(notes) ? notes : [notes];
      handlePlayNote(notesArray, 0, "note_off");
    },
    [handlePlayNote],
  );

  const handleReleaseKeyHeldNote = useCallback(
    (note: string) => {
      handlePlayNote([note], 0, "note_off", false);
    },
    [handlePlayNote],
  );

  const handleSustainChange = useCallback(
    (sustained: boolean) => {
      // Apply sustain locally first
      setSustainState(sustained);

      // Send to remote users if connected
      if (!isConnected) return;
      handlePlayNote([], 0, sustained ? "sustain_on" : "sustain_off");
    },
    [isConnected, handlePlayNote, setSustainState],
  );

  const handleSustainToggleChange = useCallback(
    (sustained: boolean) => {
      handleSustainChange(sustained);
    },
    [handleSustainChange],
  );

  return {
    handlePlayNote,
    handlePlayNoteMuted,
    createPlayNoteHandler,
    handleStopNote,
    handleReleaseKeyHeldNote,
    handleSustainChange,
    handleSustainToggleChange,
  };
};

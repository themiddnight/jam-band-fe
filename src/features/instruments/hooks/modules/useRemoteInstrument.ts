import { useCallback } from "react";
import { InstrumentCategory } from "@/shared/constants/instruments";
import type { SynthState } from "@/features/instruments";

interface UseRemoteInstrumentProps {
  instrumentManager: any;
}

export const useRemoteInstrument = ({ instrumentManager }: UseRemoteInstrumentProps) => {
  const playRemoteUserNote = useCallback(
    async (
      userId: string,
      username: string,
      notes: string[],
      velocity: number,
      instrumentName: string,
      category: InstrumentCategory,
      isKeyHeld: boolean = false,
      sampleNotes?: string[],
    ) => {
      try {
        await instrumentManager.playRemoteNotes(
          userId,
          username,
          notes,
          velocity,
          instrumentName,
          category,
          isKeyHeld,
          sampleNotes,
        );
      } catch (error) {
        console.error(
          `Failed to play remote notes for user ${username}:`,
          error,
        );
      }
    },
    [instrumentManager],
  );

  const stopRemoteUserNote = useCallback(
    async (
      userId: string,
      notes: string[],
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      try {
        await instrumentManager.stopRemoteNotes(
          userId,
          notes,
          instrumentName,
          category,
        );
      } catch (error) {
        console.error(`Failed to stop remote notes for user ${userId}:`, error);
      }
    },
    [instrumentManager],
  );

  const setRemoteUserSustain = useCallback(
    (
      userId: string,
      sustain: boolean,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      instrumentManager.setRemoteSustain(
        userId,
        sustain,
        instrumentName,
        category,
      );
    },
    [instrumentManager],
  );

  const updateRemoteUserInstrument = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      try {
        console.log(
          `🎵 updateRemoteUserInstrument: Starting update for ${username} - ${instrumentName} (${category})`,
        );
        await instrumentManager.updateRemoteInstrument(
          userId,
          username,
          instrumentName,
          category,
        );
        console.log(
          `✅ updateRemoteUserInstrument: Successfully updated ${username} to ${instrumentName} (${category})`,
        );
      } catch (error) {
        console.error(
          `❌ updateRemoteUserInstrument: Failed to update remote instrument for user ${username}:`,
          error,
        );
        console.error(
          `❌ updateRemoteUserInstrument: Error details for ${username}:`,
          {
            userId,
            username,
            instrumentName,
            category,
            error,
          },
        );
      }
    },
    [instrumentManager],
  );

  const updateRemoteUserSynthParams = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
      params: Partial<SynthState>,
    ) => {
      try {
        await instrumentManager.updateRemoteSynthParams(
          userId,
          username,
          instrumentName,
          category,
          params,
        );
      } catch (error) {
        console.error(
          `Failed to update remote synth params for user ${username}:`,
          error,
        );
      }
    },
    [instrumentManager],
  );

  const cleanupRemoteUser = useCallback(
    (userId: string) => {
      instrumentManager.removeRemoteEngine(userId);
    },
    [instrumentManager],
  );

  const preloadRoomInstruments = useCallback(
    async (
      instruments: Array<{
        userId: string;
        username: string;
        instrumentName: string;
        category: string;
      }>,
    ) => {
      try {
        await instrumentManager.preloadInstruments(instruments);
      } catch (error) {
        console.error("Failed to preload room instruments:", error);
      }
    },
    [instrumentManager],
  );

  return {
    playRemoteUserNote,
    stopRemoteUserNote,
    setRemoteUserSustain,
    updateRemoteUserInstrument,
    updateRemoteUserSynthParams,
    cleanupRemoteUser,
    preloadRoomInstruments,
  };
};

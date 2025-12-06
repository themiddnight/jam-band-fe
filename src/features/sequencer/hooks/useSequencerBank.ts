import { useCallback, useRef } from "react";
import { useSequencerStore } from "../stores/sequencerStore";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import { useEffect } from "react";

export const useSequencerBank = () => {
  const sequencerStoreRef = useRef(useSequencerStore.getState());
  const bankGenerationRef = useRef(0); // Incremented on bank switch to invalidate pending timeouts

  // Subscribe to store updates to keep ref fresh
  useEffect(() => {
    const unsubscribe = useSequencerStore.subscribe((state) => {
      sequencerStoreRef.current = state;
    });
    return () => unsubscribe();
  }, []);

  const handleBankSwitch = useCallback(
    (bankId: string) => {
      const store = sequencerStoreRef.current;
      if (store.isPlaying) {
        // During playback (both single and continuous modes), queue the bank change for next loop
        store.setWaitingBankChange(bankId);
      } else {
        // Switch immediately when not playing
        store.switchBank(bankId);
        // Increment generation even on immediate switch to be safe
        bankGenerationRef.current++;
      }
    },
    []
  );

  const handleBankToggleEnabled = useCallback(
    (bankId: string) => {
      useSequencerStore.getState().toggleBankEnabled(bankId);
    },
    []
  );

  const handleClearBank = useCallback(() => {
    useSequencerStore.getState().clearBank(useSequencerStore.getState().currentBank);
  }, []);

  const copyBank = useCallback((bankId: string) => {
    useSequencerStore.getState().copyBank(bankId);
  }, []);

  const pasteBank = useCallback((bankId: string) => {
    useSequencerStore.getState().pasteBank(bankId);
  }, []);

  // Bank shortcuts (6,7,8,9 for A,B,C,D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const bankShortcut = SEQUENCER_CONSTANTS.BANK_SHORTCUTS[event.key as keyof typeof SEQUENCER_CONSTANTS.BANK_SHORTCUTS];
      if (bankShortcut) {
        event.preventDefault();
        handleBankSwitch(bankShortcut);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBankSwitch]);

  return {
    bankGenerationRef,
    handleBankSwitch,
    handleBankToggleEnabled,
    handleClearBank,
    copyBank,
    pasteBank
  };
};

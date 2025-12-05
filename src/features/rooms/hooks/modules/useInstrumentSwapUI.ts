import { useState, useCallback, useEffect } from 'react';
import type { RoomUser } from "@/shared/types";
import { useSequencerStore } from "@/features/sequencer/stores/sequencerStore";
import { InstrumentCategory } from "@/shared/constants/instruments";

interface UseInstrumentSwapUIProps {
  currentRoom: any; // Type from your store
  currentUser: any; // Type from your store
  currentCategory: InstrumentCategory;
  synthState: any;
  requestInstrumentSwap: (targetUserId: string, synthParams?: any, sequencerState?: any) => void;
  cancelInstrumentSwap: () => void;
  approveInstrumentSwap: (requesterId: string, synthParams?: any, sequencerState?: any) => void;
  rejectInstrumentSwap: (requesterId: string) => void;
  handleInstrumentChange: (instrumentName: string) => Promise<void>;
  updateSynthParams: (params: any) => void | Promise<void>;
  requestSequencerState: (userId: string) => void;
  sequencer: any; // Type from useSequencer hook
  // Event listeners from useRoom
  onSwapRequestReceived: any;
  onSwapRequestSent: any;
  onSwapApproved: any;
  onSwapRejected: any;
  onSwapCancelled: any;
  onSwapCompleted: any;
  navigate: any;
}

export const useInstrumentSwapUI = ({
  currentRoom,
  currentUser,
  currentCategory,
  synthState,
  requestInstrumentSwap,
  cancelInstrumentSwap,
  approveInstrumentSwap,
  rejectInstrumentSwap,
  handleInstrumentChange,
  updateSynthParams,
  requestSequencerState,
  sequencer,
  onSwapRequestReceived,
  onSwapRequestSent,
  onSwapApproved,
  onSwapRejected,
  onSwapCancelled,
  onSwapCompleted,
}: UseInstrumentSwapUIProps) => {
  const [pendingSwapTarget, setPendingSwapTarget] = useState<RoomUser | null>(null);
  const [swapRequestData, setSwapRequestData] = useState<{
    requester: RoomUser | null;
    isModalOpen: boolean;
  }>({
    requester: null,
    isModalOpen: false,
  });

  const handleSwapInstrument = useCallback(
    (targetUserId: string) => {
      const targetUser = currentRoom?.users.find(
        (user: RoomUser) => user.id === targetUserId
      );
      if (targetUser) {
        setPendingSwapTarget(targetUser);
        const params = currentCategory === InstrumentCategory.Synthesizer ? synthState : undefined;
        const seqState = {
          banks: useSequencerStore.getState().banks,
          settings: useSequencerStore.getState().settings,
          currentBank: useSequencerStore.getState().currentBank,
        };
        requestInstrumentSwap(targetUserId, params, seqState);
      }
    },
    [currentRoom?.users, requestInstrumentSwap, currentCategory, synthState]
  );

  const handleCancelSwap = useCallback(() => {
    setPendingSwapTarget(null);
    cancelInstrumentSwap();
  }, [cancelInstrumentSwap]);

  const handleApproveSwap = useCallback(() => {
    if (swapRequestData.requester) {
      const params = currentCategory === InstrumentCategory.Synthesizer ? synthState : undefined;
      const seqState = {
        banks: useSequencerStore.getState().banks,
        settings: useSequencerStore.getState().settings,
        currentBank: useSequencerStore.getState().currentBank,
      };
      approveInstrumentSwap(swapRequestData.requester.id, params, seqState);
    }
    setSwapRequestData({ requester: null, isModalOpen: false });
  }, [swapRequestData.requester, approveInstrumentSwap, currentCategory, synthState]);

  const handleRejectSwap = useCallback(() => {
    if (swapRequestData.requester) {
      rejectInstrumentSwap(swapRequestData.requester.id);
    }
    setSwapRequestData({ requester: null, isModalOpen: false });
  }, [swapRequestData.requester, rejectInstrumentSwap]);

  // Setup Listeners
  useEffect(() => {
    const unsubscribeSwapRequestReceived = onSwapRequestReceived((data: any) => {
      const requesterUser = currentRoom?.users.find(
        (user: RoomUser) => user.id === data.requesterId
      );
      if (requesterUser) {
        setSwapRequestData({
          requester: requesterUser,
          isModalOpen: true,
        });
      }
    });

    const unsubscribeSwapRequestSent = onSwapRequestSent(() => {
      // Request was successfully sent
    });

    const unsubscribeSwapApproved = onSwapApproved(() => {
      setPendingSwapTarget(null);
    });

    const unsubscribeSwapRejected = onSwapRejected(() => {
      setPendingSwapTarget(null);
    });

    const unsubscribeSwapCancelled = onSwapCancelled(() => {
      setSwapRequestData({ requester: null, isModalOpen: false });
    });

    const unsubscribeSwapCompleted = onSwapCompleted(async (data: any) => {
      setPendingSwapTarget(null);
      setSwapRequestData({ requester: null, isModalOpen: false });

      const currentUserId = currentUser?.id;
      let myData = null;
      let otherData = null;

      if (data.userA.userId === currentUserId) {
        myData = data.userA;
        otherData = data.userB;
      } else if (data.userB.userId === currentUserId) {
        myData = data.userB;
        otherData = data.userA;
      }

      if (myData && otherData) {
        await handleInstrumentChange(myData.instrumentName);

        if (myData.synthParams && Object.keys(myData.synthParams).length > 0) {
          setTimeout(async () => {
            try {
              await updateSynthParams(myData.synthParams);
            } catch (error) {
              console.error("❌ Failed to apply synth parameters:", error);
            }
          }, 100);
        }

        if (myData.sequencerState) {
          try {
            if (sequencer.isPlaying) {
              useSequencerStore.getState().hardStop();
            }
            useSequencerStore.setState({
              banks: myData.sequencerState.banks,
              settings: myData.sequencerState.settings,
              currentBeat: 0,
              selectedBeat: 0,
              currentBank: myData.sequencerState.currentBank,
            });
          } catch (e) {
            console.error("❌ Failed to apply swapped sequencer state:", e);
          }
        } else if (otherData.userId) {
          requestSequencerState(otherData.userId);
        }
      }
    });

    return () => {
      unsubscribeSwapRequestReceived();
      unsubscribeSwapRequestSent();
      unsubscribeSwapApproved();
      unsubscribeSwapRejected();
      unsubscribeSwapCancelled();
      unsubscribeSwapCompleted();
    };
  }, [
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    currentRoom?.users,
    currentUser?.id,
    handleInstrumentChange,
    updateSynthParams,
    requestSequencerState,
    sequencer,
  ]);

  return {
    pendingSwapTarget,
    swapRequestData,
    handleSwapInstrument,
    handleCancelSwap,
    handleApproveSwap,
    handleRejectSwap,
    setSwapRequestData, // Exposed for manual close if needed
  };
};

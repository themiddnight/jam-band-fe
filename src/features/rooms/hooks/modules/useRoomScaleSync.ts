import { useEffect } from "react";
import { useRoomStore } from "@/features/rooms";
import { useScaleState } from "@/features/ui";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { ConnectionState } from "@/features/audio/types/connectionState";

interface UseRoomScaleSyncProps {
  connectionState: ConnectionState;
  onRoomOwnerScaleChanged: (
    callback: (data: { rootNote: string; scale: any }) => void,
  ) => () => void;
  onFollowRoomOwnerToggled: (
    callback: (data: {
      followRoomOwner: boolean;
      ownerScale?: { rootNote: string; scale: any };
    }) => void,
  ) => () => void;
}

export const useRoomScaleSync = ({
  connectionState,
  onRoomOwnerScaleChanged,
  onFollowRoomOwnerToggled,
}: UseRoomScaleSyncProps) => {
  const { currentUser, updateOwnerScale, updateUserFollowMode } =
    useRoomStore();
  const scaleState = useScaleState();
  const { setSlot, getSelectedSlot } = useScaleSlotsStore();

  // Scale event handlers
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) {
      return;
    }

    const unsubscribeOwnerScaleChanged = onRoomOwnerScaleChanged((data) => {
      updateOwnerScale(data.rootNote, data.scale);

      // If current user is following room owner, update their scale too
      if (currentUser?.followRoomOwner) {
        scaleState.setRootNote(data.rootNote);
        scaleState.setScale(data.scale);

        // Also update the current scale slot to match the new scale
        const selectedSlot = getSelectedSlot();
        if (selectedSlot) {
          setSlot(selectedSlot.id, data.rootNote, data.scale);
        }
      }
    });

    const unsubscribeFollowToggled = onFollowRoomOwnerToggled((data) => {
      if (currentUser) {
        updateUserFollowMode(currentUser.id, data.followRoomOwner);

        // If user just turned ON follow mode and there's an owner scale, sync immediately
        if (data.followRoomOwner && data.ownerScale) {
          scaleState.setRootNote(data.ownerScale.rootNote);
          scaleState.setScale(data.ownerScale.scale);

          // Also update the current scale slot to match
          const selectedSlot = getSelectedSlot();
          if (selectedSlot) {
            setSlot(
              selectedSlot.id,
              data.ownerScale.rootNote,
              data.ownerScale.scale,
            );
          }
        }
      }
    });

    return () => {
      unsubscribeOwnerScaleChanged();
      unsubscribeFollowToggled();
    };
  }, [
    connectionState,
    onRoomOwnerScaleChanged,
    onFollowRoomOwnerToggled,
    updateOwnerScale,
    currentUser,
    scaleState,
    getSelectedSlot,
    setSlot,
    updateUserFollowMode,
  ]);
};

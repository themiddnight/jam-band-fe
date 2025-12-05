import { renderHook, act } from "@testing-library/react";
import { useRoom } from "./useRoom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useUserStore } from "@/shared/stores/userStore";
import { useRoomStore } from "@/features/rooms";
import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { useInstrument } from "@/features/instruments/hooks/useInstrument";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { useMidiController } from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";

// Mock external dependencies
vi.mock("react-router-dom", () => ({
  useParams: () => ({ roomId: "test-room-id" }),
  useLocation: () => ({ state: { role: "audience" } }),
}));

vi.mock("@/shared/stores/userStore");
vi.mock("@/features/rooms");
vi.mock("@/features/audio/hooks/useRoomSocket");
vi.mock("@/features/instruments/hooks/useInstrument");
vi.mock("@/shared/stores/scaleSlotsStore");
vi.mock("@/features/audio");
vi.mock("@/features/ui", () => ({
  useScaleState: () => ({
    setRootNote: vi.fn(),
    setScale: vi.fn(),
  }),
}));
vi.mock("@/features/sequencer", () => ({
  useSequencerStore: () => ({
    isPlaying: false,
    hardStop: vi.fn(),
  }),
}));

describe("useRoom Hook", () => {
  const mockConnectToRoom = vi.fn();
  const mockLeaveRoom = vi.fn();
  const mockClearRoom = vi.fn();
  const mockOnInstrumentChanged = vi.fn(() => () => {});
  const mockOnNoteReceived = vi.fn(() => () => {});
  const mockOnUserLeft = vi.fn(() => () => {});
  const mockOnGuestCancelled = vi.fn(() => () => {});
  const mockOnMemberRejected = vi.fn(() => () => {});
  const mockOnStopAllNotes = vi.fn(() => () => {});
  const mockOnSynthParamsChanged = vi.fn(() => () => {});
  const mockOnRequestSynthParamsResponse = vi.fn(() => () => {});
  const mockOnAutoSendSynthParamsToNewUser = vi.fn(() => () => {});
  const mockOnSendCurrentSynthParamsToNewUser = vi.fn(() => () => {});
  const mockOnRequestCurrentSynthParamsForNewUser = vi.fn(() => () => {});
  const mockOnSendSynthParamsToNewUserNow = vi.fn(() => () => {});
  const mockOnSwapRequestReceived = vi.fn(() => () => {});
  const mockOnSwapRequestSent = vi.fn(() => () => {});
  const mockOnSwapApproved = vi.fn(() => () => {});
  const mockOnSwapRejected = vi.fn(() => () => {});
  const mockOnSwapCancelled = vi.fn(() => () => {});
  const mockOnSwapCompleted = vi.fn(() => () => {});
  const mockOnUserKicked = vi.fn(() => () => {});
  const mockOnRoomOwnerScaleChanged = vi.fn(() => () => {});
  const mockOnFollowRoomOwnerToggled = vi.fn(() => () => {});
  const mockGetActiveSocket = vi.fn(() => ({ on: vi.fn(), off: vi.fn() }));
  const mockSocketCleanup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useUserStore as any).mockReturnValue({
      username: "testuser",
      userId: "test-user-id",
    });

    (useRoomStore as any).mockReturnValue({
      currentRoom: { id: "test-room-id", ownerScale: null },
      currentUser: { id: "test-user-id", role: "audience" },
      pendingApproval: false,
      clearRoom: mockClearRoom,
      updateOwnerScale: vi.fn(),
      updateUserFollowMode: vi.fn(),
    });

    (useRoomSocket as any).mockReturnValue({
      connectionState: ConnectionState.DISCONNECTED,
      isConnected: false,
      isConnecting: false,
      error: null,
      connectToRoom: mockConnectToRoom,
      leaveRoom: mockLeaveRoom,
      playNote: vi.fn(),
      changeInstrument: vi.fn(),
      updateSynthParams: vi.fn(),
      stopAllNotes: vi.fn(),
      sendChatMessage: vi.fn(),
      approveMember: vi.fn(),
      rejectMember: vi.fn(),
      requestInstrumentSwap: vi.fn(),
      approveInstrumentSwap: vi.fn(),
      rejectInstrumentSwap: vi.fn(),
      cancelInstrumentSwap: vi.fn(),
      kickUser: vi.fn(),
      onNoteReceived: mockOnNoteReceived,
      onInstrumentChanged: mockOnInstrumentChanged,
      onSynthParamsChanged: mockOnSynthParamsChanged,
      onRequestSynthParamsResponse: mockOnRequestSynthParamsResponse,
      onAutoSendSynthParamsToNewUser: mockOnAutoSendSynthParamsToNewUser,
      onSendCurrentSynthParamsToNewUser: mockOnSendCurrentSynthParamsToNewUser,
      onRequestCurrentSynthParamsForNewUser: mockOnRequestCurrentSynthParamsForNewUser,
      onSendSynthParamsToNewUserNow: mockOnSendSynthParamsToNewUserNow,
      onUserLeft: mockOnUserLeft,
      onGuestCancelled: mockOnGuestCancelled,
      onMemberRejected: mockOnMemberRejected,
      onStopAllNotes: mockOnStopAllNotes,
      onSwapRequestReceived: mockOnSwapRequestReceived,
      onSwapRequestSent: mockOnSwapRequestSent,
      onSwapApproved: mockOnSwapApproved,
      onSwapRejected: mockOnSwapRejected,
      onSwapCancelled: mockOnSwapCancelled,
      onSwapCompleted: mockOnSwapCompleted,
      onUserKicked: mockOnUserKicked,
      requestSequencerState: vi.fn(),
      sendSequencerState: vi.fn(),
      onSequencerStateRequested: vi.fn(() => () => {}),
      onSequencerStateReceived: vi.fn(() => () => {}),
      onRoomOwnerScaleChanged: mockOnRoomOwnerScaleChanged,
      onFollowRoomOwnerToggled: mockOnFollowRoomOwnerToggled,
      changeRoomOwnerScale: vi.fn(),
      toggleFollowRoomOwner: vi.fn(),
      getActiveSocket: mockGetActiveSocket,
      cleanup: mockSocketCleanup,
    });

    (useInstrument as any).mockReturnValue({
      currentInstrument: "acoustic_grand_piano",
      currentCategory: "Melodic",
      availableSamples: [],
      dynamicDrumMachines: [],
      isLoadingInstrument: false,
      isAudioContextReady: true,
      audioContextError: null,
      needsUserGesture: false,
      synthState: null,
      isSynthesizerLoaded: false,
      handleInstrumentChange: vi.fn(),
      handleCategoryChange: vi.fn(),
      getCurrentInstrumentControlType: vi.fn(),
      updateSynthParams: vi.fn(),
      stopSustainedNotes: vi.fn(),
      initializeAudioContext: vi.fn(),
      playNote: vi.fn(),
      stopNotes: vi.fn(),
      setSustainState: vi.fn(),
      setRemoteUserSustain: vi.fn(),
      updateRemoteUserSynthParams: vi.fn(),
      updateRemoteUserInstrument: vi.fn(),
      playRemoteUserNote: vi.fn(),
      stopRemoteUserNote: vi.fn(),
      instrumentManager: {},
    });

    (useScaleSlotsStore as any).mockReturnValue({
      getSelectedSlot: vi.fn(),
      setSlot: vi.fn(),
    });

    (useMidiController as any).mockReturnValue({});
  });

  it("should initialize connection on mount if not connected", () => {
    renderHook(() => useRoom());
    expect(mockConnectToRoom).toHaveBeenCalledWith("test-room-id", "audience");
  });

  it("should not reconnect if already connected", () => {
    (useRoomSocket as any).mockReturnValue({
      ...useRoomSocket(), // default mocks
      connectionState: ConnectionState.IN_ROOM,
      isConnected: true,
    });

    renderHook(() => useRoom());
    expect(mockConnectToRoom).not.toHaveBeenCalled();
  });

  it("should handle leave room correctly", async () => {
    const { result } = renderHook(() => useRoom());

    await act(async () => {
      await result.current.handleLeaveRoom();
    });

    expect(mockLeaveRoom).toHaveBeenCalled();
    expect(mockClearRoom).toHaveBeenCalled();
  });

  it("should setup socket listeners when connected", () => {
    (useRoomSocket as any).mockReturnValue({
      ...useRoomSocket(),
      connectionState: ConnectionState.IN_ROOM,
    });

    renderHook(() => useRoom());

    expect(mockOnNoteReceived).toHaveBeenCalled();
    expect(mockOnInstrumentChanged).toHaveBeenCalled();
    expect(mockOnUserLeft).toHaveBeenCalled();
  });

  it("should cleanup socket listeners on unmount", () => {
    const { unmount } = renderHook(() => useRoom());
    unmount();
    expect(mockSocketCleanup).toHaveBeenCalled();
  });
});

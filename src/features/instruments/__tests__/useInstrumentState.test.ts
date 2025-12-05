import { renderHook, act } from "@testing-library/react";
import { useInstrumentState } from "../hooks/modules/useInstrumentState";
import { useUserStore } from "@/shared/stores";
import { useInstrumentPreferencesStore } from "@/features/audio";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { isSafari } from "@/shared/utils/webkitCompat";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/shared/stores", () => ({
  useUserStore: vi.fn(),
}));

vi.mock("@/features/audio", () => ({
  useInstrumentPreferencesStore: vi.fn(),
}));

vi.mock("@/shared/utils/webkitCompat", () => ({
  isSafari: vi.fn(),
}));

vi.mock("@/features/instruments", () => ({
  getCachedDrumMachines: vi.fn(() => []),
}));

describe("useInstrumentState", () => {
  const mockSetPreferences = vi.fn();
  const mockGetPreferences = vi.fn();
  const mockClearPreferences = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default store mocks
    (useUserStore as any).mockReturnValue({
      userId: "test-user-id",
      username: "Test User",
    });

    (useInstrumentPreferencesStore as any).mockReturnValue({
      setPreferences: mockSetPreferences,
      getPreferences: mockGetPreferences,
      clearPreferences: mockClearPreferences,
    });

    mockGetPreferences.mockReturnValue({}); // Default no prefs
    (isSafari as any).mockReturnValue(false);
  });

  it("should initialize with default instrument when no preferences exist", () => {
    const { result } = renderHook(() => useInstrumentState());

    expect(result.current.currentInstrument).toBe("acoustic_grand_piano");
    expect(result.current.currentCategory).toBe(InstrumentCategory.Melodic);
  });

  it("should prioritize initialInstrument prop over default", () => {
    const { result } = renderHook(() =>
      useInstrumentState({ initialInstrument: "electric_guitar_clean" })
    );

    expect(result.current.currentInstrument).toBe("electric_guitar_clean");
  });

  it("should load from preferences if available", () => {
    mockGetPreferences.mockReturnValue({
      instrument: "electric_bass_finger",
      category: InstrumentCategory.Melodic,
    });

    const { result } = renderHook(() => useInstrumentState());

    expect(result.current.currentInstrument).toBe("electric_bass_finger");
  });

  it("should auto-detect category from instrument preference", () => {
    mockGetPreferences.mockReturnValue({
      instrument: "TR-808", // Known drum machine
    });

    const { result } = renderHook(() => useInstrumentState());

    expect(result.current.currentCategory).toBe(InstrumentCategory.DrumBeat);
  });

  it("should use specific piano for Safari", () => {
    (isSafari as any).mockReturnValue(true);

    const { result } = renderHook(() => useInstrumentState());

    expect(result.current.currentInstrument).toBe("bright_acoustic_piano");
    expect(result.current.isLoadingInstrument).toBe(true); // Safari starts loading true
  });

  it("should handle fallback state updates", () => {
    const { result } = renderHook(() => useInstrumentState());

    act(() => {
      result.current.setLastFallbackInstrument("fallback_piano");
      result.current.setLastFallbackCategory(InstrumentCategory.Melodic);
    });

    expect(result.current.lastFallbackInstrument).toBe("fallback_piano");
    expect(result.current.lastFallbackCategory).toBe(
      InstrumentCategory.Melodic
    );
  });
});

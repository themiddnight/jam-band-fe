import {
  DRUMPAD_SHORTCUTS,
  DRUMPAD_COLORS,
  validatePresetAssignments,
} from "../../../../../constants/presets/drumPresets";
import { useVelocityControl } from "../../../../../hooks/useVelocityControl";
import { useDrumpadPresetsStore } from "../../../stores/drumpadPresetsStore";
import type {
  DrumPad,
  DrumpadProps,
  DrumpadState,
  DrumpadActions,
} from "../types/drumpad";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

export const useDrumpadState = ({
  onPlayNotes,
  currentInstrument = "TR-808",
  availableSamples = [],
}: Pick<DrumpadProps, "onPlayNotes" | "availableSamples"> & {
  currentInstrument?: string;
}): DrumpadState & DrumpadActions => {
  // Local state
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());
  const [padAssignments, setPadAssignments] = useState<Record<string, string>>(
    {},
  );
  const [padVolumes, setPadVolumes] = useState<Record<string, number>>({});
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedPadForAssign, setSelectedPadForAssign] = useState<
    string | null
  >(null);

  // Add velocity control hook
  const { handleVelocityChange } = useVelocityControl({
    velocity,
    setVelocity,
  });

  // Add refs for better event handling performance
  const processingKeys = useRef<Set<string>>(new Set());
  const lastPlayTime = useRef<Map<string, number>>(new Map());
  const MIN_PLAY_INTERVAL = 10; // Minimum 10ms between same pad hits to prevent spam

  // Store integration
  const {
    currentPreset,
    setCurrentInstrument: setStoreInstrument,
    loadPreset: loadStorePreset,
    savePreset: saveStorePreset,
    deletePreset: deleteStorePreset,
    exportPreset: exportStorePreset,
    importPreset: importStorePreset,
    createSmartDefaultPreset,
  } = useDrumpadPresetsStore();

  // Initialize with current instrument and load default preset
  useEffect(() => {
    setStoreInstrument(currentInstrument);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInstrument]);

  // Load and validate preset assignments when current preset or available samples change
  useEffect(() => {
    if (availableSamples.length === 0) {
      // Don't process anything if no samples are available yet
      return;
    }

    if (currentPreset?.padAssignments) {
      // Validate the preset against available samples
      const validatedPreset = validatePresetAssignments(
        currentPreset,
        availableSamples,
      );
      setPadAssignments(validatedPreset.padAssignments);
      // Load pad volumes from preset or use defaults
      setPadVolumes(validatedPreset.padVolumes || {});
    } else {
      // If no preset is loaded, create and load a smart default preset
      const smartDefaultPreset = createSmartDefaultPreset(
        currentInstrument,
        availableSamples,
      );
      loadStorePreset(smartDefaultPreset);
      setPadAssignments(smartDefaultPreset.padAssignments);
      setPadVolumes(smartDefaultPreset.padVolumes || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPreset, availableSamples, currentInstrument]);

  // Generate the fixed 16 pads
  const pads = useMemo(() => {
    const generatedPads: DrumPad[] = [];

    for (let i = 0; i < 16; i++) {
      const padId = `pad-${i}`;
      const group = i < 8 ? "A" : "B";
      const assignedSound = padAssignments[padId];
      const padVolume = padVolumes[padId] || 1; // Default to 1x multiplier

      // Create a better label from the sample name or use fallback
      let label = `${group}${(i % 8) + 1}`;
      if (assignedSound) {
        // Clean up the sample name for display
        label = assignedSound
          .replace(/_/g, " ")
          .replace(/-/g, " ")
          .replace(/\d+/g, "")
          .trim()
          .toUpperCase()
          .slice(0, 6); // Limit to 6 characters for better display

        if (!label) {
          label = assignedSound.slice(0, 6).toUpperCase();
        }
      }

      generatedPads.push({
        id: padId,
        label,
        color: DRUMPAD_COLORS[i],
        sound: assignedSound,
        isPressed: pressedPads.has(padId),
        keyboardShortcut:
          DRUMPAD_SHORTCUTS[padId as keyof typeof DRUMPAD_SHORTCUTS],
        group,
        volume: padVolume,
      });
    }

    return generatedPads;
  }, [padAssignments, padVolumes, pressedPads]);

  // Actions
  const handlePadPress = useCallback(
    async (padId: string, sound?: string) => {
      if (isEditMode) {
        setSelectedPadForAssign(padId);
        return;
      }

      // Prevent rapid-fire spam on the same pad
      const now = Date.now();
      const lastTime = lastPlayTime.current.get(padId);
      if (lastTime && now - lastTime < MIN_PLAY_INTERVAL) {
        return;
      }
      lastPlayTime.current.set(padId, now);

      setPressedPads((prev) => new Set(prev).add(padId));

      if (sound) {
        // Check if the sound is available before playing
        if (availableSamples.includes(sound)) {
          // Calculate effective velocity using global velocity and pad-specific volume
          const padVolume = padVolumes[padId] || 1;
          const effectiveVelocity = Math.min(velocity * padVolume, 1); // Cap at 1.0
          await onPlayNotes([sound], effectiveVelocity, false);
        } else {
          console.warn(`Sample not available: ${sound}`);
        }
      }
    },
    [onPlayNotes, velocity, padVolumes, isEditMode, availableSamples],
  );

  const handlePadRelease = useCallback(
    (padId: string) => {
      if (isEditMode) return;

      setPressedPads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(padId);
        return newSet;
      });
    },
    [isEditMode],
  );

  const handleSoundAssignment = useCallback(
    (sound: string) => {
      if (selectedPadForAssign) {
        setPadAssignments((prev) => ({
          ...prev,
          [selectedPadForAssign]: sound,
        }));
        setSelectedPadForAssign(null);
        setIsEditMode(false);
      }
    },
    [selectedPadForAssign],
  );

  const setPadVolume = useCallback((padId: string, volume: number) => {
    setPadVolumes((prev) => ({
      ...prev,
      [padId]: volume,
    }));
  }, []);

  const resetAssignments = useCallback(() => {
    // Reset to smart assignments if we have available samples
    if (availableSamples.length > 0) {
      const smartDefaultPreset = createSmartDefaultPreset(
        currentInstrument,
        availableSamples,
      );
      loadStorePreset(smartDefaultPreset);
      setPadAssignments(smartDefaultPreset.padAssignments);
      setPadVolumes(smartDefaultPreset.padVolumes || {});
    } else {
      setPadAssignments({});
      setPadVolumes({});
    }
    setIsEditMode(false);
    setSelectedPadForAssign(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSamples, currentInstrument]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
    setSelectedPadForAssign(null);
  }, []);

  const cancelAssignment = useCallback(() => {
    setIsEditMode(false);
    setSelectedPadForAssign(null);
  }, []);

  const loadPreset = useCallback(
    (preset: any) => {
      // Validate the preset against available samples before loading
      if (availableSamples.length > 0) {
        const validatedPreset = validatePresetAssignments(
          preset,
          availableSamples,
        );
        loadStorePreset(validatedPreset);
        setPadAssignments(validatedPreset.padAssignments);
        setPadVolumes(validatedPreset.padVolumes || {});
      } else {
        loadStorePreset(preset);
        setPadAssignments(preset.padAssignments || {});
        setPadVolumes(preset.padVolumes || {});
      }
      setIsEditMode(false);
      setSelectedPadForAssign(null);
    },
    [availableSamples, loadStorePreset],
  );

  // Optimized keyboard event handling
  useEffect(() => {
    const currentProcessingKeys = processingKeys.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditMode) return;

      const key = e.key.toLowerCase();

      // Check if the target is an input element
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]') ||
        target.hasAttribute("data-chat-input") ||
        target.closest("[data-chat-input]")
      ) {
        return;
      }

      // Handle velocity changes first
      if (handleVelocityChange(key)) {
        return;
      }

      // Early exit if key is being processed
      if (currentProcessingKeys.has(key)) {
        return;
      }

      const padEntry = Object.entries(DRUMPAD_SHORTCUTS).find(
        ([, shortcutKey]) => shortcutKey === key,
      );
      if (padEntry) {
        e.preventDefault(); // Prevent default for drum pad keys

        const [padId] = padEntry;

        // Mark key as being processed
        currentProcessingKeys.add(key);

        handlePadPress(padId, padAssignments[padId]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isEditMode) return;

      const key = e.key.toLowerCase();

      // Remove from processing keys
      currentProcessingKeys.delete(key);

      const padEntry = Object.entries(DRUMPAD_SHORTCUTS).find(
        ([, shortcutKey]) => shortcutKey === key,
      );
      if (padEntry) {
        const [padId] = padEntry;
        handlePadRelease(padId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Clear processing keys on cleanup
      currentProcessingKeys.clear();
    };
  }, [
    padAssignments,
    isEditMode,
    handlePadPress,
    handlePadRelease,
    handleVelocityChange,
  ]);

  return {
    // State
    velocity,
    pressedPads,
    padAssignments,
    padVolumes,
    isEditMode,
    selectedPadForAssign,
    currentInstrument,
    pads,

    // Actions
    setVelocity,
    setPressedPads,
    setPadAssignments,
    setPadVolumes,
    setPadVolume,
    setIsEditMode,
    setSelectedPadForAssign,
    setCurrentInstrument: setStoreInstrument,
    handlePadPress,
    handlePadRelease,
    handleSoundAssignment,
    resetAssignments,
    toggleEditMode,
    cancelAssignment,
    loadPreset,

    // Store actions
    savePreset: (
      name: string,
      description: string,
      padAssignments: Record<string, string>,
      padVolumes: Record<string, number>,
    ) => saveStorePreset(name, description, padAssignments, padVolumes),
    deletePreset: deleteStorePreset,
    exportPreset: exportStorePreset,
    importPreset: importStorePreset,
    currentPreset,
  };
};

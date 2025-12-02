import { DRUMPAD_SHORTCUTS, DRUMPAD_PAGE_SHORTCUTS } from "../../index";
import { useKeyboardHandler } from "../../index";
import { PadButton } from "./components/PadButton";
import { PresetManager } from "./components/PresetManager";
import { SoundSelectionModal } from "./components/SoundSelectionModal";
import { useDrumpadState } from "./hooks/useDrumpadState";
import type { DrumpadProps } from "./types/drumpad";
import { useState } from "react";

export default function Drumpad({
  onPlayNotes,
  onPlayNotesLocal,
  availableSamples,
  currentInstrument = "TR-808",
}: DrumpadProps) {
  const drumpadState = useDrumpadState({
    onPlayNotes,
    currentInstrument,
    availableSamples,
  });

  const {
    velocity,
    isEditMode,
    selectedPadForAssign,
    pads,
    currentPreset,
    currentPage,
    padNoteMapping,
    setVelocity,
    setCurrentPage,
    handlePadPress,
    handlePadRelease,
    resetAssignments,
    toggleEditMode,
    loadPreset,
    savePreset,
    deletePreset,
    exportPreset,
    importPreset,
    setPadAssignments,
    setPadVolume,
  } = drumpadState;

  // Modal state
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [selectedPadForModal, setSelectedPadForModal] = useState<string | null>(
    null,
  );

  // Enhanced import handler for file reading
  const handleImportPreset = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const presetData = JSON.parse(event.target?.result as string);
        importPreset(presetData);
      } catch {
        throw new Error("Invalid preset file format");
      }
    };
    reader.onerror = () => {
      throw new Error("Failed to read file");
    };
    reader.readAsText(file);
  };

  // Handle pad press in edit mode
  const handlePadPressInEditMode = (
    padId: string,
    isSliderClick: boolean = false,
  ) => {
    if (isEditMode) {
      if (isSliderClick) {
        // If it's a slider click, play the sound with current volume (local only)
        const sound = drumpadState.padAssignments[padId];
        if (sound && availableSamples.includes(sound)) {
          const padVolume = drumpadState.padVolumes[padId] || 1;
          const effectiveVelocity = Math.min(velocity * padVolume, 1);
          const playFunction = onPlayNotesLocal || onPlayNotes;
          playFunction([sound], effectiveVelocity, false);
        } else {
          console.warn(`Sample not available: ${sound}`);
        }
      } else {
        // If it's a pad click, open the sound selection modal
        setSelectedPadForModal(padId);
        setShowSoundModal(true);
      }
      return;
    }
    handlePadPress(padId, drumpadState.padAssignments[padId]);
  };

  // Handle sound preview
  const handleSoundPreview = (sound: string) => {
    if (availableSamples.includes(sound)) {
      const playFunction = onPlayNotesLocal || onPlayNotes;
      playFunction([sound], velocity, false);
    } else {
      console.warn(`Sample not available for preview: ${sound}`);
    }
  };

  // Handle sound assignment from modal
  const handleSoundAssignmentFromModal = (sound: string) => {
    if (selectedPadForModal) {
      // Update the pad assignments directly
      const updatedAssignments = {
        ...drumpadState.padAssignments,
        [selectedPadForModal]: sound,
      };
      setPadAssignments(updatedAssignments);
      setShowSoundModal(false);
      setSelectedPadForModal(null);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowSoundModal(false);
    setSelectedPadForModal(null);
  };

  // Handle volume change for a specific pad
  const handlePadVolumeChange = (padId: string, volume: number) => {
    setPadVolume(padId, volume);
  };

  // Use unified keyboard handler for drumpad shortcuts
  useKeyboardHandler({
    shortcuts: Object.fromEntries(
      Object.entries(DRUMPAD_SHORTCUTS).map(([padId, key]) => [padId, { key }]),
    ),
    onKeyDown: (key: string) => {
      if (isEditMode) return;

      const padEntry = Object.entries(DRUMPAD_SHORTCUTS).find(
        ([, shortcutKey]) => shortcutKey === key,
      );
      if (padEntry) {
        const [padId] = padEntry;
        // Don't pass the sound parameter - let handlePadPress get it from padAssignments
        handlePadPress(padId);
      }
    },
    onKeyUp: (key: string) => {
      if (isEditMode) return;

      const padEntry = Object.entries(DRUMPAD_SHORTCUTS).find(
        ([, shortcutKey]) => shortcutKey === key,
      );
      if (padEntry) {
        const [padId] = padEntry;
        handlePadRelease(padId);
      }
    },
    isEnabled: !isEditMode,
    preventDefault: true,
  });

  // Keyboard handler for page navigation (Z/X keys)
  useKeyboardHandler({
    shortcuts: {
      pageDown: { key: DRUMPAD_PAGE_SHORTCUTS.pageDown },
      pageUp: { key: DRUMPAD_PAGE_SHORTCUTS.pageUp },
    },
    onKeyDown: (key: string) => {
      if (key === DRUMPAD_PAGE_SHORTCUTS.pageDown) {
        setCurrentPage(Math.max(0, currentPage - 1));
      } else if (key === DRUMPAD_PAGE_SHORTCUTS.pageUp) {
        setCurrentPage(Math.min(2, currentPage + 1)); // Max 3 pages (0-2)
      }
    },
    isEnabled: true,
    preventDefault: true,
  });

  return (
    <div className="card bg-base-100 shadow-xl w-full ">
      <div className="card-body">
        <h3 className="card-title text-xl mb-4">Drumpad</h3>

        <div className="flex justify-between items-center gap-3 mb-3">
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            {/* Velocity Control */}
            <div className="flex items-center gap-2">
              <label className="label">
                <span className="label-text">
                  Velocity: {Math.round(velocity * 10)}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={Math.round(velocity * 10)}
                onChange={(e) => setVelocity(parseInt(e.target.value) / 10)}
                className="range range-primary range-sm w-32"
              />
            </div>

            {/* Page Navigation Control */}
            <div className="flex items-center gap-2">
              <label className="label py-1">
                <span className="label-text text-sm">
                  Page: {currentPage + 1} ({padNoteMapping["pad-0"]} - {padNoteMapping["pad-15"]})
                </span>
              </label>
              <div className="join">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  - <kbd className="kbd kbd-xs">Z</kbd>
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(2, currentPage + 1))}
                  disabled={currentPage === 2}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  + <kbd className="kbd kbd-xs">X</kbd>
                </button>
              </div>
            </div>

            {/* Edit Mode Toggle */}
            <button
              onClick={toggleEditMode}
              className={`btn btn-sm ${isEditMode ? "btn-success" : "btn-outline"}`}
            >
              {isEditMode ? "Exit Edit Mode" : "Edit Mode"}
            </button>

            {/* Reset Button */}
            <button
              onClick={resetAssignments}
              className="btn btn-sm btn-outline"
            >
              Reset
            </button>
          </div>

          {/* Preset Controls */}
          <PresetManager
            currentPreset={currentPreset}
            onLoadPreset={loadPreset}
            onSavePreset={(name, description) =>
              savePreset(
                name,
                description,
                drumpadState.padAssignments,
                drumpadState.padVolumes,
              )
            }
            onDeletePreset={deletePreset}
            onExportPreset={exportPreset}
            onImportPreset={handleImportPreset}
          />
        </div>

        {/* Drum Pad Grid */}
        <div className="flex gap-8 justify-evenly flex-wrap bg-black p-4 rounded-lg overflow-auto">
          {/* Loading indicator when no samples are available */}
          {availableSamples.length === 0 && (
            <div className="flex items-center justify-center w-full py-8">
              <div className="text-center">
                <div className="loading loading-spinner loading-lg text-primary mb-2"></div>
                <p className="text-white text-sm">Loading drum samples...</p>
              </div>
            </div>
          )}
          {/* Group A */}
          <div>
            <div className="space-y-3">
              {/* Row 1: Q W E R */}
              <div className="flex justify-center gap-3">
                {pads.slice(0, 4).map((pad) => (
                  <PadButton
                    key={pad.id}
                    pad={pad}
                    gmNote={padNoteMapping[pad.id]}
                    isEditMode={isEditMode}
                    selectedPadForAssign={selectedPadForAssign}
                    onPress={(isSliderClick) =>
                      handlePadPressInEditMode(pad.id, isSliderClick)
                    }
                    onRelease={() => handlePadRelease(pad.id)}
                    onVolumeChange={(volume) =>
                      handlePadVolumeChange(pad.id, volume)
                    }
                    availableSamples={availableSamples}
                  />
                ))}
              </div>
              {/* Row 2: A S D F */}
              <div className="flex justify-center gap-3">
                {pads.slice(4, 8).map((pad) => (
                  <PadButton
                    key={pad.id}
                    pad={pad}
                    gmNote={padNoteMapping[pad.id]}
                    isEditMode={isEditMode}
                    selectedPadForAssign={selectedPadForAssign}
                    onPress={(isSliderClick) =>
                      handlePadPressInEditMode(pad.id, isSliderClick)
                    }
                    onRelease={() => handlePadRelease(pad.id)}
                    onVolumeChange={(volume) =>
                      handlePadVolumeChange(pad.id, volume)
                    }
                    availableSamples={availableSamples}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Group B */}
          <div>
            <div className="space-y-3">
              {/* Row 1: U I O P */}
              <div className="flex justify-center gap-3">
                {pads.slice(8, 12).map((pad) => (
                  <PadButton
                    key={pad.id}
                    pad={pad}
                    gmNote={padNoteMapping[pad.id]}
                    isEditMode={isEditMode}
                    selectedPadForAssign={selectedPadForAssign}
                    onPress={(isSliderClick) =>
                      handlePadPressInEditMode(pad.id, isSliderClick)
                    }
                    onRelease={() => handlePadRelease(pad.id)}
                    onVolumeChange={(volume) =>
                      handlePadVolumeChange(pad.id, volume)
                    }
                    availableSamples={availableSamples}
                  />
                ))}
              </div>
              {/* Row 2: J K L ; */}
              <div className="flex justify-center gap-3">
                {pads.slice(12, 16).map((pad) => (
                  <PadButton
                    key={pad.id}
                    pad={pad}
                    gmNote={padNoteMapping[pad.id]}
                    isEditMode={isEditMode}
                    selectedPadForAssign={selectedPadForAssign}
                    onPress={(isSliderClick) =>
                      handlePadPressInEditMode(pad.id, isSliderClick)
                    }
                    onRelease={() => handlePadRelease(pad.id)}
                    onVolumeChange={(volume) =>
                      handlePadVolumeChange(pad.id, volume)
                    }
                    availableSamples={availableSamples}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sound Selection Modal */}
      <SoundSelectionModal
        isOpen={showSoundModal}
        onClose={handleModalClose}
        onAssign={handleSoundAssignmentFromModal}
        onPreview={handleSoundPreview}
        availableSamples={availableSamples}
        selectedPad={selectedPadForModal}
        padShortcut={
          selectedPadForModal
            ? DRUMPAD_SHORTCUTS[
                selectedPadForModal as keyof typeof DRUMPAD_SHORTCUTS
              ]
            : null
        }
      />
    </div>
  );
}

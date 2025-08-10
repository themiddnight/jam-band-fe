import { Modal } from "../../shared/Modal";
import type { SoundSelectionModalProps } from "../types/drumpad";
import React, { useState } from "react";

export const SoundSelectionModal: React.FC<SoundSelectionModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  onPreview,
  availableSamples,
  selectedPad,
  padShortcut,
}) => {
  const [selectedSound, setSelectedSound] = useState<string | null>(null);

  const handleSoundSelect = (sound: string) => {
    setSelectedSound(sound);
    onPreview(sound);
  };

  const handleAssign = () => {
    if (selectedSound) {
      onAssign(selectedSound);
      setSelectedSound(null);
    }
  };

  const handleClose = () => {
    setSelectedSound(null);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      setOpen={(open) => !open && handleClose()}
      title={`Select Sound for Pad ${selectedPad?.replace("pad-", "")} (${padShortcut?.toUpperCase()})`}
      onOk={handleAssign}
      onCancel={handleClose}
      okText="Assign Sound"
      cancelText="Cancel"
      showOkButton={!!selectedSound}
      size="2xl"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {availableSamples.map((sound) => (
          <button
            key={sound}
            className={`btn btn-sm text-left justify-start ${
              selectedSound === sound ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => handleSoundSelect(sound)}
          >
            {sound
              .replace(/-/g, " ")
              .replace(/_/g, " ")
              .replace(/\d+/g, "")
              .trim()}
          </button>
        ))}
      </div>
    </Modal>
  );
};

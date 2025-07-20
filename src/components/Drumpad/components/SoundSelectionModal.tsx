import React, { useState } from 'react';
import type { SoundSelectionModalProps } from '../types/drumpad';

export const SoundSelectionModal: React.FC<SoundSelectionModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  onPreview,
  availableSamples,
  selectedPad,
  padShortcut
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

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          Select Sound for Pad {selectedPad?.replace('pad-', '')} 
          ({padShortcut?.toUpperCase()})
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto mb-4">
          {availableSamples.map(sound => (
            <button
              key={sound}
              className={`btn btn-sm text-left justify-start ${
                selectedSound === sound ? 'btn-primary' : 'btn-outline'
              }`}
              onClick={() => handleSoundSelect(sound)}
            >
              {sound.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\d+/g, '').trim()}
            </button>
          ))}
        </div>

        <div className="modal-action">
          <button
            onClick={handleAssign}
            disabled={!selectedSound}
            className="btn btn-primary"
          >
            Assign Sound
          </button>
          <button
            onClick={handleClose}
            className="btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 
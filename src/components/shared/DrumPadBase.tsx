import React from 'react';

export interface DrumPad {
  id: string;
  label: string;
  color: string;
  sound?: string;
  isPressed: boolean;
  keyboardShortcut?: string;
}

export interface DrumPadBaseProps {
  pads: DrumPad[];
  onPadPress: (padId: string, sound?: string) => void;
  onPadRelease: (padId: string) => void;
  onPadAssign?: (padId: string, sound: string) => void;
  velocity: number;
  onVelocityChange: (velocity: number) => void;
  maxPads?: number;
  allowAssignment?: boolean;
  availableSounds?: string[];
  className?: string;
}

export const DrumPadBase: React.FC<DrumPadBaseProps> = ({
  pads,
  onPadPress,
  onPadRelease,
  onPadAssign,
  velocity,
  onVelocityChange,
  maxPads = 16,
  allowAssignment = false,
  availableSounds = [],
  className = "",
}) => {
  const [assigningPad, setAssigningPad] = React.useState<string | null>(null);

  const handlePadPress = (pad: DrumPad) => {
    if (assigningPad) return;
    onPadPress(pad.id, pad.sound);
  };

  const handlePadRelease = (pad: DrumPad) => {
    if (assigningPad) return;
    onPadRelease(pad.id);
  };

  const handleSoundAssignment = (padId: string, sound: string) => {
    if (onPadAssign) {
      onPadAssign(padId, sound);
    }
    setAssigningPad(null);
  };

  const renderPad = (pad: DrumPad) => (
    <div key={pad.id} className="relative">
      <button
        className={`
          w-20 h-20 rounded-lg border-2 transition-all duration-100 flex flex-col items-center justify-center
          ${pad.isPressed ? 'scale-95 border-gray-800' : 'border-gray-300'}
          ${pad.color} hover:brightness-110
          ${assigningPad === pad.id ? 'ring-4 ring-blue-500' : ''}
        `}
        onMouseDown={() => handlePadPress(pad)}
        onMouseUp={() => handlePadRelease(pad)}
        onMouseLeave={() => handlePadRelease(pad)}
        onContextMenu={(e) => {
          if (allowAssignment) {
            e.preventDefault();
            setAssigningPad(pad.id);
          }
        }}
      >
        <span className="text-xs font-bold text-white drop-shadow-lg">
          {pad.label}
        </span>
        {pad.keyboardShortcut && (
          <span className="text-xs text-white opacity-75">
            {pad.keyboardShortcut.toUpperCase()}
          </span>
        )}
      </button>
      
      {assigningPad === pad.id && (
        <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-10 min-w-40">
          <div className="text-sm font-medium mb-2">Assign Sound:</div>
          <div className="max-h-32 overflow-y-auto">
            {availableSounds.map(sound => (
              <button
                key={sound}
                className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                onClick={() => handleSoundAssignment(pad.id, sound)}
              >
                {sound}
              </button>
            ))}
          </div>
          <button
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setAssigningPad(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  const renderVelocityControl = () => (
    <div className="mb-4 flex items-center gap-2">
      <label className="text-sm text-gray-600">Velocity:</label>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.1"
        value={velocity}
        onChange={(e) => onVelocityChange(parseFloat(e.target.value))}
        className="w-32"
      />
      <span className="text-sm text-gray-600">{Math.round(velocity * 100)}%</span>
    </div>
  );

  const renderPadGrid = () => {
    const displayPads = pads.slice(0, maxPads);
    const emptyPads = Math.max(0, maxPads - pads.length);
    
    return (
      <div className="grid grid-cols-4 gap-3">
        {displayPads.map(renderPad)}
        {Array.from({ length: emptyPads }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
          >
            <span className="text-xs text-gray-400">Empty</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`drum-pad-base ${className}`}>
      {renderVelocityControl()}
      {allowAssignment && (
        <div className="mb-4 text-sm text-gray-600">
          Right-click pads to assign sounds
        </div>
      )}
      {renderPadGrid()}
    </div>
  );
}; 


export type ControlMode = "virtual" | "midi";

interface ControlModeSelectorProps {
  currentMode: ControlMode;
  onModeChange: (mode: ControlMode) => void;
  isMidiConnected: boolean;
}

export default function ControlModeSelector({
  currentMode,
  onModeChange,
  isMidiConnected,
}: ControlModeSelectorProps) {
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg">
      <h3 className="font-semibold text-gray-700 mb-3">Control Mode</h3>
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange("virtual")}
          className={`px-4 py-2 rounded transition-colors ${
            currentMode === "virtual"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          Virtual Keyboard
        </button>
        <button
          onClick={() => onModeChange("midi")}
          disabled={!isMidiConnected}
          className={`px-4 py-2 rounded transition-colors ${
            currentMode === "midi"
              ? "bg-green-500 text-white"
              : isMidiConnected
              ? "bg-gray-200 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          MIDI Controller
          {!isMidiConnected && (
            <span className="ml-1 text-xs">(Not Connected)</span>
          )}
        </button>
      </div>
      
      {currentMode === "virtual" && (
        <p className="text-xs text-gray-600 mt-2">
          Use your computer keyboard or click on the virtual keys
        </p>
      )}
      
      {currentMode === "midi" && isMidiConnected && (
        <p className="text-xs text-green-600 mt-2">
          ✓ MIDI controller connected - use your physical keys
        </p>
      )}
      
      {currentMode === "midi" && !isMidiConnected && (
        <p className="text-xs text-red-600 mt-2">
          Connect a MIDI device to use physical controller mode
        </p>
      )}
    </div>
  );
} 
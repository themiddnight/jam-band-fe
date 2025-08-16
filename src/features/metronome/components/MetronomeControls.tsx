import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { AnchoredPopup } from '@/features/ui';
import { useMetronome } from '../hooks/useMetronome';
import { formatBpm, validateBpm } from '../utils';
import { METRONOME_CONFIG } from '../constants';

interface MetronomeControlsProps {
  socket: Socket | null;
  canEdit: boolean; // Whether user can edit metronome (room owner or band member)
}

export const MetronomeControls: React.FC<MetronomeControlsProps> = ({ 
  socket, 
  canEdit 
}) => {
  const {
    bpm,
    isMuted,
    volume,
    handleBpmChange,
    handleToggleMute,
    handleVolumeChange,
    handleTapTempo,
    resetTapTempo,
    getTapCount,
    hasAudioFile,
  } = useMetronome({ socket, canEdit });

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [inputBpm, setInputBpm] = useState(bpm.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const bpmButtonRef = React.useRef<HTMLButtonElement>(null);

  // Update input when BPM changes from socket
  React.useEffect(() => {
    if (!isInputFocused) {
      setInputBpm(bpm.toString());
    }
  }, [bpm, isInputFocused]);

  // Validate current input BPM
  const isValidBpm = React.useMemo(() => {
    const numericBpm = parseInt(inputBpm, 10);
    return !isNaN(numericBpm) && numericBpm >= METRONOME_CONFIG.MIN_BPM && numericBpm <= METRONOME_CONFIG.MAX_BPM;
  }, [inputBpm]);

  const handleInputBpmChange = (value: string) => {
    // Allow empty string and numeric input only
    if (value === '' || /^\d+$/.test(value)) {
      setInputBpm(value);
      
      // Auto-apply valid BPM changes while typing (real-time update)
      if (value !== '' && canEdit) {
        const numericBpm = parseInt(value, 10);
        if (!isNaN(numericBpm) && numericBpm >= METRONOME_CONFIG.MIN_BPM && numericBpm <= METRONOME_CONFIG.MAX_BPM) {
          handleBpmChange(numericBpm);
        }
      }
    }
  };

  const handleInputSubmit = () => {
    if (!canEdit) return;
    
    const numericBpm = parseInt(inputBpm, 10);
    
    // If empty or invalid, reset to current BPM
    if (inputBpm === '' || isNaN(numericBpm)) {
      setInputBpm(bpm.toString());
      return;
    }
    
    // Clamp to valid range and apply
    const validBpm = validateBpm(numericBpm);
    handleBpmChange(validBpm);
    setInputBpm(validBpm.toString());
  };

  const tapCount = getTapCount();
  const canTap = canEdit && tapCount < 8;

  return (
    <div className="card bg-base-100 shadow-lg grow">
      <div className="card-body p-3">
      <div className="flex justify-center items-center gap-3">
      <label className="label py-1 hidden lg:block">
        <span className="label-text text-xs">Metronome</span>
      </label>
        {/* BPM Display/Input */}
        <button
          ref={bpmButtonRef}
          onClick={() => setIsPopupOpen(true)}
          disabled={!canEdit}
          className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors
            ${canEdit 
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          title={canEdit ? 'Click to set BPM' : 'Only room owner and band members can edit metronome'}
        >
          <span className="text-xs opacity-75">♩</span>
          <span>{formatBpm(bpm)}</span>
        </button>

        {/* Mute Button */}
        <button
          onClick={handleToggleMute}
          className={`p-2 rounded transition-colors
            ${isMuted 
              ? 'bg-gray-600 hover:bg-gray-700 text-gray-400' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          title={isMuted ? 'Unmute metronome (personal)' : 'Mute metronome (personal)'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">🔉</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none slider"
            title="Volume (personal setting)"
          />
        </div>

        {/* Sound file status indicator */}
        {!hasAudioFile && (
          <div 
            className="w-2 h-2 bg-yellow-500 rounded-full" 
            title="Using fallback sound - place metronome-tick.wav in /public/sounds/ for better sound"
          />
        )}

        {/* BPM Settings Popup */}
        <AnchoredPopup
          open={isPopupOpen}
          onClose={() => {
            setIsPopupOpen(false);
            resetTapTempo();
          }}
          anchorRef={bpmButtonRef}
          placement="top"
          className="p-4 bg-gray-800 border border-gray-600 rounded-lg shadow-lg min-w-[200px]"
        >
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm font-medium text-white mb-2">Set Tempo</h3>
            </div>

            {/* Manual BPM Input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                BPM ({METRONOME_CONFIG.MIN_BPM}-{METRONOME_CONFIG.MAX_BPM})
              </label>
              <input
                type="number"
                min={METRONOME_CONFIG.MIN_BPM}
                max={METRONOME_CONFIG.MAX_BPM}
                value={inputBpm}
                onChange={(e) => handleInputBpmChange(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  setIsInputFocused(false);
                  handleInputSubmit();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleInputSubmit();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`w-full px-2 py-1 text-sm rounded text-white transition-colors ${
                  !canEdit 
                    ? 'bg-gray-700 border border-gray-600 cursor-not-allowed'
                    : inputBpm === '' || !isValidBpm
                    ? 'bg-gray-700 border border-red-500 focus:border-red-400'
                    : 'bg-gray-700 border border-green-500 focus:border-green-400'
                }`}
                disabled={!canEdit}
                placeholder={`${METRONOME_CONFIG.MIN_BPM}-${METRONOME_CONFIG.MAX_BPM}`}
              />
              {canEdit && inputBpm !== '' && !isValidBpm && (
                <p className="text-xs text-red-400 mt-1">
                  Must be between {METRONOME_CONFIG.MIN_BPM} and {METRONOME_CONFIG.MAX_BPM}
                </p>
              )}
            </div>

            {/* Tap Tempo */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Tap Tempo {tapCount > 0 && `(${tapCount} taps)`}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleTapTempo}
                  disabled={!canTap}
                  className={`flex-1 px-3 py-2 text-sm rounded transition-colors
                    ${canTap 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Tap
                </button>
                <button
                  onClick={resetTapTempo}
                  disabled={tapCount === 0}
                  className={`px-2 py-2 text-sm rounded transition-colors
                    ${tapCount > 0 
                      ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  title="Reset taps"
                >
                  ↻
                </button>
              </div>
              {tapCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Keep tapping to refine tempo
                </p>
              )}
            </div>

            {/* Permission notice */}
            {!canEdit && (
              <div className="text-xs text-yellow-400 text-center bg-yellow-900/20 p-2 rounded">
                Only room owner and band members can change tempo
              </div>
            )}
          </div>
        </AnchoredPopup>
        </div>
      </div>
    </div>
  );
};

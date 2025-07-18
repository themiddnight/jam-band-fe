import React, { useState, useEffect } from 'react';
import { AUDIO_CONFIG } from '../../constants/audioConfig';

interface LatencyControlsProps {
  onConfigChange?: (config: typeof AUDIO_CONFIG) => void;
}

export const LatencyControls: React.FC<LatencyControlsProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState(AUDIO_CONFIG);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const updateConfig = (section: keyof typeof AUDIO_CONFIG, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <div className="bg-gray-100 px-4 py-3 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left font-medium text-gray-700 hover:text-gray-900"
      >
        <span>🎛️ Latency Settings</span>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Tone.js Context Settings */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Tone.js Context</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Look Ahead (ms)
                  <span className="text-xs text-gray-500 ml-1">Lower = less latency</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={config.TONE_CONTEXT.lookAhead * 1000}
                  onChange={(e) => updateConfig('TONE_CONTEXT', 'lookAhead', parseInt(e.target.value) / 1000)}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {(config.TONE_CONTEXT.lookAhead * 1000).toFixed(0)}ms
                </span>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Update Interval (ms)
                  <span className="text-xs text-gray-500 ml-1">Lower = more responsive</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={config.TONE_CONTEXT.updateInterval * 1000}
                  onChange={(e) => updateConfig('TONE_CONTEXT', 'updateInterval', parseInt(e.target.value) / 1000)}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {(config.TONE_CONTEXT.updateInterval * 1000).toFixed(0)}ms
                </span>
              </div>
            </div>
          </div>

          {/* Audio Context Settings */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Audio Context</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Latency Hint</label>
              <select
                value={config.AUDIO_CONTEXT.latencyHint}
                onChange={(e) => updateConfig('AUDIO_CONTEXT', 'latencyHint', e.target.value as AudioContextLatencyCategory)}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="interactive">Interactive (Lowest Latency)</option>
                <option value="balanced">Balanced</option>
                <option value="playback">Playback (Highest Quality)</option>
              </select>
            </div>
          </div>

          {/* Synthesizer Settings */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Synthesizer</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Note Retrigger Delay (ms)
                  <span className="text-xs text-gray-500 ml-1">Lower = faster response</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={config.SYNTHESIZER.noteRetriggerDelay}
                  onChange={(e) => updateConfig('SYNTHESIZER', 'noteRetriggerDelay', parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {config.SYNTHESIZER.noteRetriggerDelay}ms
                </span>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Min Attack Time (ms)
                  <span className="text-xs text-gray-500 ml-1">Lower = more responsive</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={config.SYNTHESIZER.envelopeAttackMin * 1000}
                  onChange={(e) => updateConfig('SYNTHESIZER', 'envelopeAttackMin', parseFloat(e.target.value) / 1000)}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {(config.SYNTHESIZER.envelopeAttackMin * 1000).toFixed(1)}ms
                </span>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => setConfig(AUDIO_CONFIG)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reset to Default
            </button>
            <button
              onClick={() => setConfig({
                ...AUDIO_CONFIG,
                TONE_CONTEXT: { lookAhead: 0.005, updateInterval: 0.005 },
                SYNTHESIZER: { noteRetriggerDelay: 1, envelopeAttackMin: 0.0005 }
              })}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Ultra Low Latency
            </button>
            <button
              onClick={() => setConfig({
                ...AUDIO_CONFIG,
                TONE_CONTEXT: { lookAhead: 0.05, updateInterval: 0.025 },
                SYNTHESIZER: { noteRetriggerDelay: 5, envelopeAttackMin: 0.01 }
              })}
              className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Safe/Compatible
            </button>
          </div>
          
          <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
            <strong>Note:</strong> Lower latency settings may increase CPU usage and cause audio glitches on slower devices.
            Restart the synthesizer after changing settings for full effect.
          </div>
        </div>
      )}
    </div>
  );
}; 
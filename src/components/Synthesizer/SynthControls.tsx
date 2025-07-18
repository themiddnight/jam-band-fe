import React, { useState } from "react";
import { SYNTHESIZER_INSTRUMENTS } from "../../constants/instruments";
import { usePresetManager } from "../../hooks/usePresetManager";
import { DEFAULT_PRESETS } from "../../constants/defaultPresets";
import type { SynthState } from "../../hooks/useToneSynthesizer";
import type { SynthPreset } from "../../types/presets";
import { LatencyControls } from "./LatencyControls";

interface SynthControlsProps {
  currentInstrument: string;
  synthState: SynthState;
  onParamChange: (params: Partial<SynthState>) => void;
  onLoadPreset?: (presetParams: SynthState) => void;
}

export const SynthControls: React.FC<SynthControlsProps> = ({
  currentInstrument,
  synthState,
  onParamChange,
  onLoadPreset,
}) => {
  const currentSynthData = SYNTHESIZER_INSTRUMENTS.find(
    (synth) => synth.value === currentInstrument
  );

  const presetManager = usePresetManager();
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showImportExport, setShowImportExport] = useState(false);
  const [importData, setImportData] = useState("");

  if (!currentSynthData) return null;

  const isAnalog = currentSynthData.type === "analog";
  const isFM = currentSynthData.type === "fm";

  // Get relevant presets for current synthesizer type
  const availablePresets = [
    ...DEFAULT_PRESETS.filter(preset => 
      preset.synthType === currentSynthData.type && 
      preset.polyphony === currentSynthData.polyphony
    ),
    ...presetManager.getPresetsForSynth(
      currentSynthData.type as "analog" | "fm",
      currentSynthData.polyphony as "mono" | "poly"
    )
  ];

  const handleSavePreset = () => {
    if (presetName.trim()) {
      presetManager.savePreset(
        presetName.trim(),
        currentSynthData.type as "analog" | "fm",
        currentSynthData.polyphony as "mono" | "poly",
        synthState
      );
      setPresetName("");
      setShowPresetModal(false);
    }
  };

  const handleLoadPreset = (preset: SynthPreset) => {
    if (onLoadPreset) {
      onLoadPreset(preset.parameters);
    } else {
      onParamChange(preset.parameters);
    }
    presetManager.loadPreset(preset);
  };

  const handleExportPresets = () => {
    const data = presetManager.exportPresets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synth-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresets = () => {
    if (importData.trim()) {
      presetManager.importPresets(importData.trim());
      setImportData("");
      setShowImportExport(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">
          {currentSynthData.label} Controls
        </h3>
        
        {/* Preset Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Save Preset
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Import/Export
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      {availablePresets.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Load Preset
          </label>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1">
                <button
                  onClick={() => handleLoadPreset(preset)}
                  className={`px-3 py-1 rounded text-sm ${
                    presetManager.currentPreset?.id === preset.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {preset.name}
                </button>
                {!DEFAULT_PRESETS.find(p => p.id === preset.id) && (
                  <button
                    onClick={() => presetManager.deletePreset(preset.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                    title="Delete preset"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {presetManager.error && (
        <div className="mb-4 p-2 bg-red-900 text-red-200 rounded text-sm">
          {presetManager.error}
        </div>
      )}

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Save Preset</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name"
              className="w-full p-2 bg-gray-700 text-white rounded mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowPresetModal(false);
                  setPresetName("");
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import/Export Modal */}
      {showImportExport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Import/Export Presets</h3>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={handleExportPresets}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Export All Presets
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Import Presets (JSON)
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste preset JSON data here"
                  className="w-full p-2 bg-gray-700 text-white rounded h-32 resize-none"
                />
                <button
                  onClick={handleImportPresets}
                  disabled={!importData.trim()}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowImportExport(false);
                  setImportData("");
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Latency Controls */}
      <div className="mb-6">
        <LatencyControls onConfigChange={(config) => {
          console.log('Latency config updated:', config);
          // Note: The config changes will be applied on next synthesizer initialization
        }} />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Common Controls */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Amp Attack
          </label>
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.001"
            value={synthState.ampAttack}
            onChange={(e) => onParamChange({ ampAttack: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">
            {synthState.ampAttack.toFixed(3)}s
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Amp Decay
          </label>
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.001"
            value={synthState.ampDecay}
            onChange={(e) => onParamChange({ ampDecay: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">
            {synthState.ampDecay.toFixed(3)}s
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Amp Sustain
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={synthState.ampSustain}
            onChange={(e) => onParamChange({ ampSustain: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">
            {synthState.ampSustain.toFixed(2)}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Amp Release
          </label>
          <input
            type="range"
            min="0.001"
            max="5"
            step="0.001"
            value={synthState.ampRelease}
            onChange={(e) => onParamChange({ ampRelease: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">
            {synthState.ampRelease.toFixed(3)}s
          </span>
        </div>

        {/* Analog Synthesizer Controls */}
        {isAnalog && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Oscillator Type
              </label>
              <select
                value={synthState.oscillatorType}
                onChange={(e) => onParamChange({ oscillatorType: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              >
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Frequency
              </label>
              <input
                type="range"
                min="100"
                max="8000"
                step="10"
                value={synthState.filterFrequency}
                onChange={(e) => onParamChange({ filterFrequency: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterFrequency.toFixed(0)}Hz
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Resonance
              </label>
              <input
                type="range"
                min="0.1"
                max="30"
                step="0.1"
                value={synthState.filterResonance}
                onChange={(e) => onParamChange({ filterResonance: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterResonance.toFixed(1)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Attack
              </label>
              <input
                type="range"
                min="0.001"
                max="2"
                step="0.001"
                value={synthState.filterAttack}
                onChange={(e) => onParamChange({ filterAttack: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterAttack.toFixed(3)}s
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Decay
              </label>
              <input
                type="range"
                min="0.001"
                max="2"
                step="0.001"
                value={synthState.filterDecay}
                onChange={(e) => onParamChange({ filterDecay: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterDecay.toFixed(3)}s
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Sustain
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.filterSustain}
                onChange={(e) => onParamChange({ filterSustain: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterSustain.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Filter Release
              </label>
              <input
                type="range"
                min="0.001"
                max="5"
                step="0.001"
                value={synthState.filterRelease}
                onChange={(e) => onParamChange({ filterRelease: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.filterRelease.toFixed(3)}s
              </span>
            </div>
          </>
        )}

        {/* FM Synthesizer Controls */}
        {isFM && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Modulation Index
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="0.1"
                value={synthState.modulationIndex}
                onChange={(e) => onParamChange({ modulationIndex: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.modulationIndex.toFixed(1)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Harmonicity
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.01"
                value={synthState.harmonicity}
                onChange={(e) => onParamChange({ harmonicity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.harmonicity.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Mod Attack
              </label>
              <input
                type="range"
                min="0.001"
                max="2"
                step="0.001"
                value={synthState.modAttack}
                onChange={(e) => onParamChange({ modAttack: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.modAttack.toFixed(3)}s
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Mod Decay
              </label>
              <input
                type="range"
                min="0.001"
                max="2"
                step="0.001"
                value={synthState.modDecay}
                onChange={(e) => onParamChange({ modDecay: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.modDecay.toFixed(3)}s
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Mod Sustain
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.modSustain}
                onChange={(e) => onParamChange({ modSustain: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.modSustain.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Mod Release
              </label>
              <input
                type="range"
                min="0.001"
                max="5"
                step="0.001"
                value={synthState.modRelease}
                onChange={(e) => onParamChange({ modRelease: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">
                {synthState.modRelease.toFixed(3)}s
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}; 
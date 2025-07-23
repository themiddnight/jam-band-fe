import React, { useState } from "react";
import { SYNTHESIZER_INSTRUMENTS } from "../../constants/instruments";
import { usePresetManager } from "../../hooks/usePresetManager";
import { DEFAULT_PRESETS } from "../../constants/defaultPresets";
import type { SynthState } from "../../hooks/useToneSynthesizer";
import type { SynthPreset } from "../../types/presets";
import { LatencyControls } from "./LatencyControls";
import { Knob } from "../shared/Knob";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<SynthPreset | null>(null);

  if (!currentSynthData) return null;

  const isAnalog = currentSynthData.type === "analog";
  const isFM = currentSynthData.type === "fm";

  // Get relevant presets for current synthesizer type
  const availablePresets = [
    ...DEFAULT_PRESETS.filter(
      (preset) =>
        preset.synthType === currentSynthData.type &&
        preset.polyphony === currentSynthData.polyphony
    ),
    ...presetManager.getPresetsForSynth(
      currentSynthData.type as "analog" | "fm",
      currentSynthData.polyphony as "mono" | "poly"
    ),
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
    console.log("🎛️ Loading preset:", preset.name);
    if (onLoadPreset) {
      onLoadPreset(preset.parameters);
    } else {
      onParamChange(preset.parameters);
    }
    presetManager.loadPreset(preset);
    
    // Ensure all preset parameters are synchronized to remote users
    console.log("🎛️ Syncing all preset parameters to remote users:", preset.parameters);
    // The onParamChange will trigger the sync through the callback mechanism
  };

  const handleExportPresets = () => {
    const data = presetManager.exportPresets();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "synth-presets.json";
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
    <div className="card bg-neutral text-neutral-content shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center gap-5">
          <div className="flex gap-2">
            <h3 className="card-title">{currentSynthData.label} Controls</h3>
            <LatencyControls
              onConfigChange={() => {
                // Note: The config changes will be applied on next synthesizer initialization
              }}
            />
          </div>

          {/* Preset Controls */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowPresetModal(true)}
              className="btn btn-primary btn-xs"
            >
              Save Preset
            </button>
            {presetManager.currentPreset && (
              <button
                onClick={() => {
                  const currentPreset = presetManager.currentPreset;
                  if (currentPreset) {
                    setPresetToDelete(currentPreset);
                    setShowDeleteModal(true);
                  }
                }}
                className="btn btn-error btn-xs"
                title="Delete current preset"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => setShowImportExport(true)}
              className="btn btn-secondary btn-xs"
            >
              Import/Export
            </button>
            {availablePresets.length > 0 && (
              <select
                value={presetManager.currentPreset?.id || ""}
                onChange={(e) => {
                  const selectedPreset = availablePresets.find(
                    (p) => p.id === e.target.value
                  );
                  if (selectedPreset) {
                    handleLoadPreset(selectedPreset);
                  }
                }}
                className="select select-bordered select-xs flex-1"
              >
                <option value="">Select a preset...</option>
                {availablePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Error Display */}
        {presetManager.error && (
          <div className="alert alert-error ">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{presetManager.error}</span>
          </div>
        )}

        {/* Save Preset Modal */}
        {showPresetModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg ">Save Preset</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Enter preset name"
                  className="input input-bordered w-full"
                  onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                />
              </div>
              <div className="modal-action">
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="btn btn-primary"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowPresetModal(false);
                    setPresetName("");
                  }}
                  className="btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import/Export Modal */}
        {showImportExport && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg ">Import/Export Presets</h3>

              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleExportPresets}
                    className="btn btn-success w-full"
                  >
                    Export All Presets
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="label">
                    <span className="label-text">Import Presets (JSON)</span>
                  </label>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="Paste preset JSON data here"
                    className="textarea textarea-bordered h-32 resize-none"
                  />
                  <button
                    onClick={handleImportPresets}
                    disabled={!importData.trim()}
                    className="btn btn-primary mt-2"
                  >
                    Import
                  </button>
                </div>
              </div>

              <div className="modal-action">
                <button
                  onClick={() => {
                    setShowImportExport(false);
                    setImportData("");
                  }}
                  className="btn"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Preset Modal */}
        {showDeleteModal && presetToDelete && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg text-error">Delete Preset</h3>
              <p className="py-4">
                Are you sure you want to delete "{presetToDelete.name}"? This action cannot be undone.
              </p>
              <div className="modal-action">
                <button
                  onClick={() => {
                    presetManager.deletePreset(presetToDelete.id);
                    setShowDeleteModal(false);
                    setPresetToDelete(null);
                  }}
                  className="btn btn-error"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPresetToDelete(null);
                  }}
                  className="btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analog Synthesizer Controls */}
        {isAnalog && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap">
              {/* Oscillator Group */}
              <div className="card bg-base-200 grow">
                <div className="card-body">
                  <h4 className="card-title text-sm">Oscillator</h4>
                  <div className="flex justify-around items-center flex-wrap gap-3">
                    <div className="flex flex-col gap-2">
                      <select
                        value={synthState.oscillatorType}
                        onChange={(e) =>
                          onParamChange({ oscillatorType: e.target.value })
                        }
                        className="select select-bordered"
                      >
                        <option value="sine">Sine</option>
                        <option value="square">Square</option>
                        <option value="sawtooth">Sawtooth</option>
                        <option value="triangle">Triangle</option>
                      </select>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.volume || 0.5}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => onParamChange({ volume: value })}
                        size={50}
                        color="primary"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Volume
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Group */}
              <div className="card bg-base-200 grow">
                <div className="card-body">
                  <h4 className="card-title text-sm">Filter</h4>
                  <div className="flex justify-around flex-wrap gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterFrequency}
                        min={20}
                        max={20000}
                        step={1}
                        onChange={(value) =>
                          onParamChange({ filterFrequency: value })
                        }
                        size={50}
                        curve="logarithmic"
                        color="secondary"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Freq
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterResonance}
                        min={0.1}
                        max={30}
                        step={0.1}
                        onChange={(value) =>
                          onParamChange({ filterResonance: value })
                        }
                        size={50}
                        color="secondary"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Res
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amp Envelope Group */}
              <div className="card bg-base-200 grow">
                <div className="card-body">
                  <h4 className="card-title text-sm">Amp Envelope</h4>
                  <div className="flex justify-around flex-wrap gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.ampAttack}
                        min={0.001}
                        max={2}
                        step={0.001}
                        onChange={(value) =>
                          onParamChange({ ampAttack: value })
                        }
                        size={50}
                        color="accent"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Attack
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.ampDecay}
                        min={0.001}
                        max={10}
                        step={0.001}
                        onChange={(value) => onParamChange({ ampDecay: value })}
                        size={50}
                        color="accent"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Decay
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.ampSustain}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          onParamChange({ ampSustain: value })
                        }
                        size={50}
                        color="accent"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Sustain
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.ampRelease}
                        min={0.001}
                        max={5}
                        step={0.001}
                        onChange={(value) =>
                          onParamChange({ ampRelease: value })
                        }
                        size={50}
                        color="accent"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Release
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Envelope Group */}
              <div className="card bg-base-200 grow">
                <div className="card-body">
                  <h4 className="card-title text-sm">Filter Envelope</h4>
                  <div className="flex justify-around flex-wrap gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterAttack}
                        min={0.001}
                        max={2}
                        step={0.001}
                        onChange={(value) =>
                          onParamChange({ filterAttack: value })
                        }
                        size={50}
                        color="info"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Attack
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterDecay}
                        min={0.001}
                        max={10}
                        step={0.001}
                        onChange={(value) =>
                          onParamChange({ filterDecay: value })
                        }
                        size={50}
                        color="info"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Decay
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterSustain}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          onParamChange({ filterSustain: value })
                        }
                        size={50}
                        color="info"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Sustain
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Knob
                        value={synthState.filterRelease}
                        min={0.001}
                        max={5}
                        step={0.001}
                        onChange={(value) =>
                          onParamChange({ filterRelease: value })
                        }
                        size={50}
                        color="info"
                      />
                      <label className="label">
                        <span className="label-text text-neutral-content text-xs">
                          Release
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FM Synthesizer Controls */}
        {isFM && (
          <div className="flex gap-3 flex-wrap">
            {/* Volume Group */}
            <div className="card bg-base-200 grow">
              <div className="card-body">
                <h4 className="card-title text-sm">Volume</h4>
                <div className="flex justify-around flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.volume || 0.5}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(value) => onParamChange({ volume: value })}
                      size={50}
                      color="primary"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Volume
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modulation Group */}
            <div className="card bg-base-200 grow">
              <div className="card-body">
                <h4 className="card-title text-sm">Modulation</h4>
                <div className="flex justify-around flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.modulationIndex}
                      min={0}
                      max={50}
                      step={0.1}
                      onChange={(value) =>
                        onParamChange({ modulationIndex: value })
                      }
                      size={50}
                      color="secondary"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Modulation Index
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.harmonicity}
                      min={0.1}
                      max={10}
                      step={0.01}
                      onChange={(value) =>
                        onParamChange({ harmonicity: value })
                      }
                      size={50}
                      color="secondary"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Harmonicity
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Amp Envelope Group */}
            <div className="card bg-base-200 grow">
              <div className="card-body">
                <h4 className="card-title text-sm">Amp Envelope</h4>
                <div className="flex justify-around flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.ampAttack}
                      min={0.001}
                      max={2}
                      step={0.001}
                      onChange={(value) => onParamChange({ ampAttack: value })}
                      size={50}
                      color="accent"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Attack
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.ampDecay}
                      min={0.001}
                      max={10}
                      step={0.001}
                      onChange={(value) => onParamChange({ ampDecay: value })}
                      size={50}
                      color="accent"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Decay
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.ampSustain}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(value) => onParamChange({ ampSustain: value })}
                      size={50}
                      color="accent"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Sustain
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.ampRelease}
                      min={0.001}
                      max={5}
                      step={0.001}
                      onChange={(value) => onParamChange({ ampRelease: value })}
                      size={50}
                      color="accent"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Release
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modulation Envelope Group */}
            <div className="card bg-base-200 grow">
              <div className="card-body">
                <h4 className="card-title text-sm">Modulation Envelope</h4>
                <div className="flex justify-around flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.modAttack}
                      min={0.001}
                      max={2}
                      step={0.001}
                      onChange={(value) => onParamChange({ modAttack: value })}
                      size={50}
                      color="info"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Attack
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.modDecay}
                      min={0.001}
                      max={10}
                      step={0.001}
                      onChange={(value) => onParamChange({ modDecay: value })}
                      size={50}
                      color="info"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Decay
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.modSustain}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(value) => onParamChange({ modSustain: value })}
                      size={50}
                      color="info"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Sustain
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Knob
                      value={synthState.modRelease}
                      min={0.001}
                      max={5}
                      step={0.001}
                      onChange={(value) => onParamChange({ modRelease: value })}
                      size={50}
                      color="info"
                    />
                    <label className="label">
                      <span className="label-text text-neutral-content text-xs">
                        Release
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

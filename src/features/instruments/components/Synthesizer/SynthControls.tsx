import { synthPresetValidator } from "@/shared/hooks/presetManagement";
import { PresetManager } from "@/shared/components";
import { DEFAULT_SYNTH_PRESETS } from "../../index";
import type { SynthPreset } from "../../types/presets";
import type { SynthState } from "../../utils/InstrumentEngine";
import { LatencyControls } from "./LatencyControls";
import { Knob } from "@/features/ui";
import { SYNTHESIZER_INSTRUMENTS } from "@/shared/constants/instruments";
import React from "react";

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
    (synth) => synth.value === currentInstrument,
  );

  if (!currentSynthData) return null;

  const isAnalog = currentSynthData.type === "analog";
  const isFM = currentSynthData.type === "fm";

  const handleSavePreset = (partialPreset: Partial<SynthPreset>) => {
    // This will be called by PresetManager with just the name
    // We need to add the full preset data
    return {
      ...partialPreset,
      synthType: currentSynthData.type as "analog" | "fm",
      polyphony: currentSynthData.polyphony as "mono" | "poly",
      parameters: synthState,
    } as SynthPreset;
  };

  const handleLoadPreset = (preset: SynthPreset) => {
    if (onLoadPreset) {
      onLoadPreset(preset.parameters);
    } else {
      onParamChange(preset.parameters);
    }
    console.log(
      "🎛️ Syncing all preset parameters to remote users:",
      preset.parameters,
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
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

          {/* Centralized Preset Manager */}
          <PresetManager<SynthPreset>
            storageKey="jam-band-synth-presets"
            version="1.0.0"
            validator={synthPresetValidator}
            currentContext={{
              synthType: currentSynthData.type,
              polyphony: currentSynthData.polyphony,
            }}
            contextDescription={`the current synthesizer type (${currentSynthData.type} ${currentSynthData.polyphony})`}
            filterPresets={(preset) =>
              preset.synthType === currentSynthData.type &&
              preset.polyphony === currentSynthData.polyphony
            }
            getExportFilename={() =>
              `synth-presets-${currentSynthData.type}-${currentSynthData.polyphony}.json`
            }
            onSave={(partialPreset) => {
              const fullPreset = handleSavePreset(partialPreset);
              // The PresetManager will handle the actual save through the hook
              return fullPreset;
            }}
            onLoad={handleLoadPreset}
            size="xs"
            additionalPresets={DEFAULT_SYNTH_PRESETS as any}
          />
        </div>

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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                        <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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
                      <span className="label-text text-base-content text-xs">
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

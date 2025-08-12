import { AUDIO_CONFIG } from "@/features/audio";
import { Modal } from "@/features/ui";
import React, { useState, useEffect } from "react";

interface LatencyControlsProps {
  onConfigChange?: (config: typeof AUDIO_CONFIG) => void;
}

export const LatencyControls: React.FC<LatencyControlsProps> = ({
  onConfigChange,
}) => {
  const [config, setConfig] = useState(AUDIO_CONFIG);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const updateConfig = (
    section: keyof typeof AUDIO_CONFIG,
    key: string,
    value: any,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => setShowModal(true)}
        title="Configure latency settings"
      >
        <p className="">⚙️</p>
      </button>

      {/* Modal */}
      <Modal
        open={showModal}
        setOpen={setShowModal}
        title="🎛️ Latency Settings"
        onCancel={() => setShowModal(false)}
        showOkButton={false}
        size="2xl"
      >
        <div className="space-y-6">
          {/* Tone.js Context Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-base-content">Tone.js Context</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label">
                  <span className="label-text text-sm">Look Ahead (ms)</span>
                  <span className="label-text-alt text-xs">
                    Lower = less latency
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={config.TONE_CONTEXT.lookAhead * 1000}
                    onChange={(e) =>
                      updateConfig(
                        "TONE_CONTEXT",
                        "lookAhead",
                        parseInt(e.target.value) / 1000,
                      )
                    }
                    className="range range-sm range-primary flex-1"
                  />
                  <span className="label-text-alt text-xs min-w-[3rem]">
                    {(config.TONE_CONTEXT.lookAhead * 1000).toFixed(0)}ms
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label">
                  <span className="label-text text-sm">
                    Update Interval (ms)
                  </span>
                  <span className="label-text-alt text-xs">
                    Lower = more responsive
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={config.TONE_CONTEXT.updateInterval * 1000}
                    onChange={(e) =>
                      updateConfig(
                        "TONE_CONTEXT",
                        "updateInterval",
                        parseInt(e.target.value) / 1000,
                      )
                    }
                    className="range range-sm range-primary flex-1"
                  />
                  <span className="label-text-alt text-xs min-w-[3rem]">
                    {(config.TONE_CONTEXT.updateInterval * 1000).toFixed(0)}
                    ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Context Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-base-content">Audio Context</h4>
            <div className="space-y-2">
              <label className="label">
                <span className="label-text text-sm">Latency Hint</span>
              </label>
              <select
                value={config.AUDIO_CONTEXT.latencyHint}
                onChange={(e) =>
                  updateConfig(
                    "AUDIO_CONTEXT",
                    "latencyHint",
                    e.target.value as AudioContextLatencyCategory,
                  )
                }
                className="select select-bordered select-sm w-full"
              >
                <option value="interactive">
                  Interactive (Lowest Latency)
                </option>
                <option value="balanced">Balanced</option>
                <option value="playback">Playback (Highest Quality)</option>
              </select>
            </div>
          </div>

          {/* Synthesizer Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-base-content">Synthesizer</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label">
                  <span className="label-text text-sm">
                    Note Retrigger Delay (ms)
                  </span>
                  <span className="label-text-alt text-xs">
                    Lower = faster response
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={config.SYNTHESIZER.noteRetriggerDelay}
                    onChange={(e) =>
                      updateConfig(
                        "SYNTHESIZER",
                        "noteRetriggerDelay",
                        parseFloat(e.target.value),
                      )
                    }
                    className="range range-sm range-primary flex-1"
                  />
                  <span className="label-text-alt text-xs min-w-[3rem]">
                    {config.SYNTHESIZER.noteRetriggerDelay}ms
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label">
                  <span className="label-text text-sm">
                    Min Attack Time (ms)
                  </span>
                  <span className="label-text-alt text-xs">
                    Lower = more responsive
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={config.SYNTHESIZER.envelopeAttackMin * 1000}
                    onChange={(e) =>
                      updateConfig(
                        "SYNTHESIZER",
                        "envelopeAttackMin",
                        parseFloat(e.target.value) / 1000,
                      )
                    }
                    className="range range-sm range-primary flex-1"
                  />
                  <span className="label-text-alt text-xs min-w-[3rem]">
                    {(config.SYNTHESIZER.envelopeAttackMin * 1000).toFixed(1)}
                    ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-base-300">
            <button
              onClick={() => setConfig(AUDIO_CONFIG)}
              className="btn btn-primary btn-sm"
            >
              Reset to Default
            </button>
            <button
              onClick={() =>
                setConfig({
                  ...AUDIO_CONFIG,
                  TONE_CONTEXT: { lookAhead: 0.005, updateInterval: 0.005 },
                  SYNTHESIZER: {
                    noteRetriggerDelay: 1,
                    envelopeAttackMin: 0.0005,
                  },
                })
              }
              className="btn btn-success btn-sm"
            >
              Ultra Low Latency
            </button>
            <button
              onClick={() =>
                setConfig({
                  ...AUDIO_CONFIG,
                  TONE_CONTEXT: { lookAhead: 0.05, updateInterval: 0.025 },
                  SYNTHESIZER: {
                    noteRetriggerDelay: 5,
                    envelopeAttackMin: 0.01,
                  },
                })
              }
              className="btn btn-warning btn-sm"
            >
              Safe/Compatible
            </button>
          </div>

          <div className="alert alert-warning">
            <div>
              <div className="font-bold">Note:</div>
              <div className="text-sm">
                Lower latency settings may increase CPU usage and cause audio
                glitches on slower devices. Restart the synthesizer after
                changing settings for full effect.
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

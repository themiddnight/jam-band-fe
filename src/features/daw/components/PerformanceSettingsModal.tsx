import { useState, useEffect } from "react";
import { Modal } from "@/features/ui";

interface PerformanceSettings {
  audioBufferSize: number;
  waveformQuality: "low" | "medium" | "high";
  latencyCompensation: boolean;
  viewportCulling: boolean;
  maxVisibleTracks: number;
  audioLookahead: number;
}

interface PerformanceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (settings: PerformanceSettings) => void;
  currentSettings?: Partial<PerformanceSettings>;
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  audioBufferSize: 256,
  waveformQuality: "medium",
  latencyCompensation: true,
  viewportCulling: true,
  maxVisibleTracks: 50,
  audioLookahead: 0.1,
};

export const PerformanceSettingsModal = ({
  open,
  onClose,
  onSave,
  currentSettings,
}: PerformanceSettingsModalProps) => {
  const [settings, setSettings] = useState<PerformanceSettings>({
    ...DEFAULT_SETTINGS,
    ...currentSettings,
  });

  useEffect(() => {
    if (open) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...currentSettings,
      });
    }
  }, [open, currentSettings]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <Modal
      open={open}
      setOpen={onClose}
      title="⚡ Performance Settings"
      size="lg"
      showOkButton={true}
      showCancelButton={true}
      okText="Save"
      cancelText="Cancel"
      onOk={handleSave}
      onCancel={onClose}
    >
      <div className="space-y-6">
        {/* Audio Buffer Size */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Audio Buffer Size</span>
            <span className="label-text-alt">{settings.audioBufferSize} samples</span>
          </label>
          <input
            type="range"
            min="128"
            max="2048"
            step="128"
            value={settings.audioBufferSize}
            onChange={(e) =>
              setSettings({ ...settings, audioBufferSize: Number(e.target.value) })
            }
            className="range range-primary range-sm"
          />
          <div className="w-full flex justify-between text-xs px-2 mt-1">
            <span>128</span>
            <span>256</span>
            <span>512</span>
            <span>1024</span>
            <span>2048</span>
          </div>
          <p className="text-xs text-base-content/70 mt-2">
            Lower values reduce latency but increase CPU usage. Higher values improve stability.
          </p>
        </div>

        {/* Waveform Quality */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Waveform Quality</span>
          </label>
          <select
            value={settings.waveformQuality}
            onChange={(e) =>
              setSettings({
                ...settings,
                waveformQuality: e.target.value as "low" | "medium" | "high",
              })
            }
            className="select select-bordered select-sm"
          >
            <option value="low">Low (Faster rendering)</option>
            <option value="medium">Medium (Balanced)</option>
            <option value="high">High (Best quality)</option>
          </select>
          <p className="text-xs text-base-content/70 mt-2">
            Affects waveform rendering detail. Lower quality improves performance with many tracks.
          </p>
        </div>

        {/* Latency Compensation */}
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              checked={settings.latencyCompensation}
              onChange={(e) =>
                setSettings({ ...settings, latencyCompensation: e.target.checked })
              }
              className="checkbox checkbox-primary checkbox-sm"
            />
            <div className="flex flex-col">
              <span className="label-text font-semibold">Latency Compensation</span>
              <span className="text-xs text-base-content/70">
                Automatically compensate for audio processing delays
              </span>
            </div>
          </label>
        </div>

        {/* Viewport Culling */}
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              checked={settings.viewportCulling}
              onChange={(e) =>
                setSettings({ ...settings, viewportCulling: e.target.checked })
              }
              className="checkbox checkbox-primary checkbox-sm"
            />
            <div className="flex flex-col">
              <span className="label-text font-semibold">Viewport Culling</span>
              <span className="text-xs text-base-content/70">
                Only render visible tracks and regions (recommended for large projects)
              </span>
            </div>
          </label>
        </div>

        {/* Max Visible Tracks */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Max Visible Tracks</span>
            <span className="label-text-alt">{settings.maxVisibleTracks} tracks</span>
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={settings.maxVisibleTracks}
            onChange={(e) =>
              setSettings({ ...settings, maxVisibleTracks: Number(e.target.value) })
            }
            className="range range-primary range-sm"
          />
          <div className="w-full flex justify-between text-xs px-2 mt-1">
            <span>10</span>
            <span>50</span>
            <span>100</span>
          </div>
          <p className="text-xs text-base-content/70 mt-2">
            Maximum number of tracks to render simultaneously
          </p>
        </div>

        {/* Audio Lookahead */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Audio Lookahead</span>
            <span className="label-text-alt">{settings.audioLookahead.toFixed(2)}s</span>
          </label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={settings.audioLookahead}
            onChange={(e) =>
              setSettings({ ...settings, audioLookahead: Number(e.target.value) })
            }
            className="range range-primary range-sm"
          />
          <div className="w-full flex justify-between text-xs px-2 mt-1">
            <span>0s</span>
            <span>0.25s</span>
            <span>0.5s</span>
          </div>
          <p className="text-xs text-base-content/70 mt-2">
            Time to schedule audio events in advance. Higher values improve timing accuracy.
          </p>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t border-base-300">
          <button onClick={handleReset} className="btn btn-ghost btn-sm">
            Reset to Defaults
          </button>
        </div>
      </div>
    </Modal>
  );
};

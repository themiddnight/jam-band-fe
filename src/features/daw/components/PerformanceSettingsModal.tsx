import { useState, useEffect } from "react";
import { Modal } from "@/features/ui";

interface PerformanceSettings {
  waveformQuality: "low" | "medium" | "high";
  viewportCulling: boolean;
  audioLookahead: number;
}

interface PerformanceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (settings: PerformanceSettings) => void;
  currentSettings?: Partial<PerformanceSettings>;
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  waveformQuality: "medium",
  viewportCulling: true,
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
            Affects waveform rendering detail. Lower quality improves performance with many audio regions.
          </p>
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
            Time to schedule audio events in advance. Higher values improve timing accuracy but increase latency.
          </p>
        </div>

        {/* Info about removed settings */}
        <div className="alert alert-info text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>Audio buffer size and latency compensation cannot be changed at runtime and have been removed.</span>
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

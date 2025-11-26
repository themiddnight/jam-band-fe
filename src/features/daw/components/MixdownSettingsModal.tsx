import { useState } from 'react';
import type { MixdownSettings } from '../hooks/useMixdown';

interface MixdownSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (settings: MixdownSettings) => void;
  isExporting?: boolean;
}

export function MixdownSettingsModal({
  open,
  onClose,
  onExport,
  isExporting = false,
}: MixdownSettingsModalProps) {
  const [bitDepth, setBitDepth] = useState<16 | 24 | 32>(16);
  const [sampleRate, setSampleRate] = useState<44100 | 48000 | 96000>(44100);

  const handleExport = () => {
    onExport({ bitDepth, sampleRate });
  };

  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Export Mixdown</h3>
        
        <div className="space-y-4">
          {/* Bit Depth Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Bit Depth</span>
            </label>
            <div className="flex gap-2">
              <button
                className={`btn btn-sm flex-1 ${bitDepth === 16 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setBitDepth(16)}
                disabled={isExporting}
              >
                16-bit
              </button>
              <button
                className={`btn btn-sm flex-1 ${bitDepth === 24 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setBitDepth(24)}
                disabled={isExporting}
              >
                24-bit
              </button>
              <button
                className={`btn btn-sm flex-1 ${bitDepth === 32 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setBitDepth(32)}
                disabled={isExporting}
              >
                32-bit
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/70">
                Higher bit depth = better dynamic range
              </span>
            </label>
          </div>

          {/* Sample Rate Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Sample Rate</span>
            </label>
            <div className="flex gap-2">
              <button
                className={`btn btn-sm flex-1 ${sampleRate === 44100 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSampleRate(44100)}
                disabled={isExporting}
              >
                44.1 kHz
              </button>
              <button
                className={`btn btn-sm flex-1 ${sampleRate === 48000 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSampleRate(48000)}
                disabled={isExporting}
              >
                48 kHz
              </button>
              <button
                className={`btn btn-sm flex-1 ${sampleRate === 96000 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSampleRate(96000)}
                disabled={isExporting}
              >
                96 kHz
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/70">
                Higher sample rate = better frequency response
              </span>
            </label>
          </div>

          {/* File Info */}
          <div className="alert alert-info">
            <div className="text-sm">
              <div className="font-semibold mb-1">Export Settings:</div>
              <div>Format: WAV (uncompressed)</div>
              <div>Quality: {bitDepth}-bit / {(sampleRate / 1000).toFixed(1)} kHz</div>
              <div className="mt-2 text-xs opacity-70">
                The mixdown will capture all tracks in real-time, including effects and automation.
              </div>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

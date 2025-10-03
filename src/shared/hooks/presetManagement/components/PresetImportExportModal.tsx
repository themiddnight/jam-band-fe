import React, { useState, useRef } from 'react';
import { Modal } from '@/features/ui';
import type { ImportOptions, PresetImportResult, BasePreset } from '../index';

export interface PresetImportExportModalProps<T extends BasePreset> {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File, options: ImportOptions) => Promise<PresetImportResult<T>>;
  contextDescription?: string;
}

export function PresetImportExportModal<T extends BasePreset>({
  open,
  onClose,
  onExport,
  onImport,
  contextDescription = 'current configuration',
}: PresetImportExportModalProps<T>) {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [showImportError, setShowImportError] = useState(false);
  const [importErrorMessage, setImportErrorMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setImportMode('merge');
    setShowImportError(false);
    setImportErrorMessage('');
    onClose();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const result = await onImport(file, { mode: importMode });

      if (!result.success) {
        setImportErrorMessage(result.errorMessage || 'Import failed');
        setShowImportError(true);
      } else if (result.incompatiblePresets.length > 0) {
        // Some were incompatible
        setImportErrorMessage(result.errorMessage || 'Some presets were incompatible');
        setShowImportError(true);
      }

      // Close modal on success (unless there's a warning to show)
      if (result.success && result.incompatiblePresets.length === 0) {
        handleClose();
      }
    } catch {
      setImportErrorMessage('An unexpected error occurred during import');
      setShowImportError(true);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Import/Export Modal */}
      <Modal
        open={open}
        setOpen={handleClose}
        title="Import/Export Presets"
        onCancel={handleClose}
        showOkButton={false}
        size="lg"
      >
        <div className="space-y-4">
          {/* Export Section */}
          <div className="border border-base-300 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Export Presets</h4>
            <p className="text-sm text-base-content/70 mb-3">
              Download all your saved presets as a JSON file.
            </p>
            <button onClick={onExport} className="btn btn-success w-full">
              📥 Export All Presets
            </button>
          </div>

          {/* Import Section */}
          <div className="border border-base-300 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Import Presets</h4>
            <p className="text-sm text-base-content/70 mb-3">
              Import presets from a JSON file. Only presets matching {contextDescription} will be
              imported.
            </p>

            {/* Import Mode Selection */}
            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text font-medium">Import Mode</span>
              </label>
              <div className="flex flex-col gap-2">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    className="radio radio-primary"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    disabled={isImporting}
                  />
                  <span className="label-text">Merge (keep existing presets)</span>
                </label>
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    className="radio radio-primary"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    disabled={isImporting}
                  />
                  <span className="label-text">Replace (remove all existing presets)</span>
                </label>
              </div>
            </div>

            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="file-input file-input-bordered file-input-primary w-full"
              disabled={isImporting}
            />
            {isImporting && (
              <div className="mt-2 text-sm text-base-content/70">Importing presets...</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Import Error/Warning Modal */}
      <Modal
        open={showImportError}
        setOpen={setShowImportError}
        title="Import Warning"
        onOk={() => {
          setShowImportError(false);
          // If there were compatible presets imported, close the parent modal
          handleClose();
        }}
        showCancelButton={false}
        okText="OK"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{importErrorMessage}</span>
          </div>
        </div>
      </Modal>
    </>
  );
}

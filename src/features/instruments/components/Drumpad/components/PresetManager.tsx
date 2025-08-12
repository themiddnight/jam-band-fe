import { useDrumpadPresetsStore } from "../../../stores/drumpadPresetsStore";
import { Modal } from "../../../../../components/shared/Modal";
import type { PresetManagerProps } from "../types/drumpad";
import React, { useState } from "react";

export const PresetManager: React.FC<PresetManagerProps> = ({
  currentPreset,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  onExportPreset,
  onImportPreset,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [showImportExport, setShowImportExport] = useState(false);
  const [importData, setImportData] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { getPresetsForCurrentInstrument } = useDrumpadPresetsStore();
  const availablePresets = getPresetsForCurrentInstrument();

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim(), presetDescription.trim());
      setPresetName("");
      setPresetDescription("");
      setShowSaveModal(false);
    }
  };

  const handleExportPresets = () => {
    if (currentPreset) {
      onExportPreset(currentPreset);
    }
  };

  const handleImportPresets = () => {
    if (importData.trim()) {
      try {
        const presetData = JSON.parse(importData.trim());
        onImportPreset(presetData);
        setImportData("");
        setShowImportExport(false);
      } catch (error) {
        console.error("Failed to import preset:", error);
      }
    }
  };

  return (
    <>
      {/* Preset Controls - Following SynthControls pattern */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowSaveModal(true)}
          className="btn btn-primary btn-xs"
        >
          Save Preset
        </button>

        {currentPreset && (
          <button
            onClick={() => setShowDeleteModal(true)}
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
            value={currentPreset?.id || ""}
            onChange={(e) => {
              const selectedPreset = availablePresets.find(
                (p) => p.id === e.target.value,
              );
              if (selectedPreset) {
                onLoadPreset(selectedPreset);
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

      {/* Save Preset Modal */}
      <Modal
        open={showSaveModal}
        setOpen={setShowSaveModal}
        title="Save Preset"
        onOk={handleSavePreset}
        onCancel={() => {
          setShowSaveModal(false);
          setPresetName("");
          setPresetDescription("");
        }}
        okText="Save"
        cancelText="Cancel"
        showOkButton={!!presetName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Preset Name *</span>
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name"
              className="input input-bordered w-full"
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="Optional description"
              className="textarea textarea-bordered w-full"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Import/Export Modal */}
      <Modal
        open={showImportExport}
        setOpen={setShowImportExport}
        title="Import/Export Presets"
        onCancel={() => {
          setShowImportExport(false);
          setImportData("");
        }}
        showOkButton={false}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <button
              onClick={handleExportPresets}
              disabled={!currentPreset}
              className="btn btn-success w-full"
            >
              Export Current Preset
            </button>
          </div>
          <div>
            <label className="label">
              <span className="label-text">Import Preset (JSON)</span>
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste preset JSON data here"
              className="textarea textarea-bordered w-full h-32 resize-none"
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
      </Modal>

      {/* Delete Preset Modal */}
      <Modal
        open={showDeleteModal}
        setOpen={setShowDeleteModal}
        title="Delete Preset"
        onOk={() => {
          if (currentPreset) {
            onDeletePreset(currentPreset.id);
            setShowDeleteModal(false);
          }
        }}
        onCancel={() => setShowDeleteModal(false)}
        okText="Delete"
        cancelText="Cancel"
      >
        <p className="py-4">
          Are you sure you want to delete "{currentPreset?.name}"? This action
          cannot be undone.
        </p>
      </Modal>
    </>
  );
};

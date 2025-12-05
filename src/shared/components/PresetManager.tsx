import { useState, useMemo } from "react";
import { Modal } from "@/features/ui/components/shared/Modal";
import { usePresetManager, PresetImportExportModal } from "@/shared/hooks/presetManagement";
import type { BasePreset, PresetValidator, ImportOptions } from "@/shared/hooks/presetManagement";

interface PresetManagerProps<T extends BasePreset> {
  // Configuration
  storageKey: string;
  version: string;
  validator?: PresetValidator<T>;

  // Context for filtering and validation
  currentContext?: any;
  contextDescription?: string;

  // Filter function to determine which presets to show
  filterPresets?: (preset: T, context: any) => boolean;

  // Export filename customization
  getExportFilename?: (context: any) => string;

  // Callbacks
  onSave?: (partialPreset: Partial<T>) => T;  // Should return full preset with all data
  onLoad?: (preset: T) => void;
  onDelete?: (presetId: string) => void;
  onImportSuccess?: (presets: T[]) => void;
  onImportError?: (error: string) => void;

  // UI customization
  saveButtonText?: string;
  saveButtonDisabled?: boolean;
  saveButtonTitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;

  // Additional presets to merge with stored ones (e.g., default presets)
  additionalPresets?: T[];

  // Children for rendering save modal content
  renderSaveModalContent?: (presetName: string, setPresetName: (name: string) => void) => React.ReactNode;

  // Backend type for saving to account
  backendType?: 'SYNTH' | 'EFFECT' | 'SEQUENCER' | 'INSTRUMENT';
}

export function PresetManager<T extends BasePreset>({
  storageKey,
  version,
  validator,
  currentContext,
  contextDescription = "current settings",
  filterPresets,
  getExportFilename,
  onSave,
  onLoad,
  onDelete,
  onImportSuccess,
  onImportError,
  saveButtonText = "Save",
  saveButtonDisabled = false,
  saveButtonTitle = "Save current settings as preset",
  size = 'sm',
  className = "",
  additionalPresets = [],
  renderSaveModalContent,
  backendType,
}: PresetManagerProps<T>) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetToDelete, setPresetToDelete] = useState<T | null>(null);

  const presetManager = usePresetManager<T>({
    storageKey,
    version,
    validator,
    backendType,
    onImportSuccess: (presets) => {
      onImportSuccess?.(presets);
    },
    onImportError: (error) => {
      console.error(`❌ Preset import error:`, error);
      onImportError?.(error);
    },
  });

  // Combine stored presets with additional presets (e.g., defaults)
  const allPresets = useMemo(() => {
    return [...additionalPresets, ...presetManager.presets];
  }, [additionalPresets, presetManager.presets]);

  // Filter presets based on current context
  const availablePresets = useMemo(() => {
    if (!filterPresets) return allPresets;
    return allPresets.filter((preset) => filterPresets(preset, currentContext));
  }, [allPresets, filterPresets, currentContext]);

  const handleSavePreset = () => {
    if (presetName.trim()) {
      if (onSave) {
        // Get the full preset data from the parent
        const fullPreset = onSave({ name: presetName.trim() } as T);
        // Actually save it through the preset manager
        presetManager.savePreset(fullPreset);
      }
      setPresetName("");
      setShowSaveModal(false);
    }
  };

  const handleLoadPreset = (preset: T) => {
    presetManager.loadPreset(preset);
    onLoad?.(preset);
  };

  const handleDeletePreset = () => {
    if (presetToDelete) {
      const isAdditionalPreset = additionalPresets.some(p => p.id === presetToDelete.id);

      if (isAdditionalPreset) {
        // Can't delete default/additional presets
        console.warn("Cannot delete default preset");
        setShowDeleteModal(false);
        setPresetToDelete(null);
        return;
      }

      presetManager.deletePreset(presetToDelete.id);
      onDelete?.(presetToDelete.id);
      setPresetToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleExportPresets = () => {
    const data = presetManager.exportPresets();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getExportFilename
      ? getExportFilename(currentContext)
      : `presets-${storageKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresets = async (file: File, options: ImportOptions) => {
    return await presetManager.importPresetsFromFile(file, {
      ...options,
      context: currentContext,
    });
  };

  const buttonSize = `btn-${size}`;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Preset Selector */}
      {availablePresets.length > 0 && (
        <select
          value={presetManager.currentPreset?.id || ""}
          onChange={(e) => {
            if (e.target.value) {
              const selectedPreset = availablePresets.find(
                (p) => p.id === e.target.value
              );
              if (selectedPreset) {
                handleLoadPreset(selectedPreset);
              }
            }
          }}
          className={`select select-bordered ${buttonSize} w-40`}
          title="Select a preset to load"
        >
          <option value="">Load preset...</option>
          {availablePresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      )}

      {/* Save Button */}
      <button
        onClick={() => setShowSaveModal(true)}
        className={`btn btn-primary ${buttonSize}`}
        disabled={saveButtonDisabled}
        title={saveButtonTitle}
      >
        💾 {saveButtonText}
      </button>

      {/* Import/Export Button */}
      <button
        onClick={() => setShowImportExport(true)}
        className={`btn btn-secondary ${buttonSize}`}
        title="Import or export presets"
      >
        ⇅ Import/Export
      </button>

      {/* Delete Button */}
      {presetManager.currentPreset && (
        <button
          onClick={() => {
            setPresetToDelete(presetManager.currentPreset);
            setShowDeleteModal(true);
          }}
          className={`btn btn-error ${buttonSize}`}
          disabled={additionalPresets.some(p => p.id === presetManager.currentPreset?.id)}
          title={
            additionalPresets.some(p => p.id === presetManager.currentPreset?.id)
              ? "Cannot delete default preset"
              : "Delete current preset"
          }
        >
          🗑️ Delete
        </button>
      )}

      {/* Error Display */}
      {presetManager.error && (
        <div className="alert alert-error w-full">
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
      <Modal
        open={showSaveModal}
        setOpen={setShowSaveModal}
        title="Save Preset"
        onOk={handleSavePreset}
        onCancel={() => {
          setShowSaveModal(false);
          setPresetName("");
        }}
        okText="Save"
        cancelText="Cancel"
        showOkButton={!!presetName.trim()}
      >
        {renderSaveModalContent ? (
          renderSaveModalContent(presetName, setPresetName)
        ) : (
          <div className="space-y-4">
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Preset Name</span>
              </label>
              <input
                type="text"
                placeholder="Enter preset name..."
                className="input input-bordered w-full"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && presetName.trim()) {
                    handleSavePreset();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Generic Import/Export Modal */}
      <PresetImportExportModal
        open={showImportExport}
        onClose={() => setShowImportExport(false)}
        onExport={handleExportPresets}
        onImport={handleImportPresets}
        contextDescription={contextDescription}
      />

      {/* Delete Preset Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        setOpen={setShowDeleteModal}
        title="Delete Preset"
        onOk={handleDeletePreset}
        onCancel={() => {
          setShowDeleteModal(false);
          setPresetToDelete(null);
        }}
        okText="Delete"
        cancelText="Cancel"
      >
        <div className="space-y-4">
          <p>
            Are you sure you want to delete the preset "
            {presetToDelete?.name}"?
          </p>
          <p className="text-sm text-base-content/70">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}

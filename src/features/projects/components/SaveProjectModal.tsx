import { useState, useEffect } from "react";
import { Modal } from "@/features/ui";

interface SaveProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  existingProjectName?: string;
  isSaving?: boolean;
}

export function SaveProjectModal({
  open,
  onClose,
  onSave,
  existingProjectName,
  isSaving = false,
}: SaveProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setProjectName(existingProjectName || "");
      setError(null);
    }
  }, [open, existingProjectName]);

  const handleSave = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      await onSave(projectName.trim());
      setProjectName("");
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    }
  };

  const handleCancel = () => {
    setProjectName("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && handleCancel()}
      title={existingProjectName ? "Save Project Over" : "Save Project"}
      okText={isSaving ? "Saving..." : existingProjectName ? "Save Over" : "Save"}
      cancelText="Cancel"
      onOk={handleSave}
      onCancel={handleCancel}
      showOkButton={!!projectName.trim() && !isSaving}
      showCancelButton={!isSaving}
      allowClose={!isSaving}
      size="md"
    >
      <div className="space-y-4">
        <div className="form-control">
          <label className="label" htmlFor="projectName">
            <span className="label-text">Project Name</span>
          </label>
          <input
            id="projectName"
            type="text"
            placeholder="Enter project name"
            className="input input-bordered w-full"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setError(null);
            }}
            disabled={isSaving}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && projectName.trim() && !isSaving) {
                handleSave();
              }
            }}
          />
          {existingProjectName && (
            <label className="label">
              <span className="label-text-alt text-warning">
                This will overwrite the existing project "{existingProjectName}"
              </span>
            </label>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}


import { useState } from "react";
import { Modal } from "@/features/ui";
import type { SavedProject } from "@/shared/api/projects";
import { deleteProject } from "@/shared/api/projects";

interface ProjectLimitModalProps {
  open: boolean;
  onClose: () => void;
  projects: SavedProject[];
  onProjectDeleted: () => void;
}

export function ProjectLimitModal({
  open,
  onClose,
  projects,
  onProjectDeleted,
}: ProjectLimitModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    setDeletingId(projectId);
    setError(null);

    try {
      await deleteProject(projectId);
      onProjectDeleted();
      if (projects.length === 1) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && onClose()}
      title="Project Limit Reached"
      okText="Close"
      cancelText={null}
      onOk={onClose}
      showCancelButton={false}
      size="md"
    >
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span>
            You have reached the limit of 2 saved projects. Please delete an existing project to save a new one.
          </span>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Your Saved Projects:</h3>
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-base-content/60">
                    {project.roomType === "perform" ? "Perform Room" : "Arrange Room"} •{" "}
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-error"
                  onClick={() => handleDelete(project.id)}
                  disabled={deletingId === project.id}
                >
                  {deletingId === project.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
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


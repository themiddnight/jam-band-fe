import { useState } from "react";
import { Modal } from "@/features/ui";
import type { SavedProject } from "@/shared/api/projects";

interface OpenProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: SavedProject;
  onOpen: (roomName: string, description?: string) => Promise<void>;
  isOpening?: boolean;
}

export function OpenProjectModal({
  open,
  onClose,
  project,
  onOpen,
  isOpening = false,
}: OpenProjectModalProps) {
  const [roomName, setRoomName] = useState(project.name);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    try {
      await onOpen(roomName.trim(), description.trim() || undefined);
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open project");
    }
  };

  const handleCancel = () => {
    setRoomName(project.name);
    setDescription("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && handleCancel()}
      title="Open Project"
      okText={isOpening ? "Opening..." : "Create Room & Open"}
      cancelText="Cancel"
      onOk={handleOpen}
      onCancel={handleCancel}
      showOkButton={!!roomName.trim() && !isOpening}
      showCancelButton={!isOpening}
      allowClose={!isOpening}
      size="md"
    >
      <div className="space-y-4">
        <div className="alert alert-info">
          <span>
            This will create a new arrange room and load the project into it.
          </span>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="roomName">
            <span className="label-text">Room Name</span>
          </label>
          <input
            id="roomName"
            type="text"
            placeholder="Enter room name"
            className="input input-bordered w-full"
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
              setError(null);
            }}
            disabled={isOpening}
            autoFocus
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="roomDescription">
            <span className="label-text">Description (Optional)</span>
          </label>
          <textarea
            id="roomDescription"
            placeholder="Describe your room..."
            className="textarea textarea-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isOpening}
            rows={3}
          />
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


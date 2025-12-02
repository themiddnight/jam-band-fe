import { useState, useEffect } from "react";
import { Modal } from "@/features/ui";
import type { SavedProject } from "@/shared/api/projects";

interface OpenProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: SavedProject;
  onOpen: (roomName: string, description?: string, isPrivate?: boolean, isHidden?: boolean) => Promise<void>;
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when project changes or modal opens
  useEffect(() => {
    if (open) {
      setRoomName(project.name);
      setDescription("");
      setIsPrivate(false);
      setIsHidden(false);
      setError(null);
    }
  }, [open, project]);

  const handleOpen = async () => {
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    try {
      await onOpen(roomName.trim(), description.trim() || undefined, isPrivate, isHidden);
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open project");
    }
  };

  const handleCancel = () => {
    setRoomName(project.name);
    setDescription("");
    setIsPrivate(false);
    setIsHidden(false);
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

        <div className="form-control">
          <label className="label cursor-pointer flex items-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              disabled={isOpening}
            />
            <div className="flex flex-col">
              <span className="label-text select-none">Private Room</span>
              <p className="text-sm text-base-content/50">
                Band members need approval to join
              </p>
            </div>
          </label>
        </div>

        <div className="form-control">
          <label className="label cursor-pointer flex items-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={isHidden}
              onChange={(e) => setIsHidden(e.target.checked)}
              disabled={isOpening}
            />
            <div className="flex flex-col">
              <span className="label-text select-none">Hidden Room</span>
              <p className="text-sm text-base-content/50">
                Room won't appear in the public list
              </p>
            </div>
          </label>
        </div>

        {/* Privacy and visibility combination warnings */}
        {isPrivate && isHidden && (
          <div className="alert alert-warning">
            <div>
              <h4 className="font-bold">Private & Hidden Room</h4>
              <p className="text-sm">
                This room will be hidden from the lobby and require approval for band members.
                Only users with direct invite links can find and join this room.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}


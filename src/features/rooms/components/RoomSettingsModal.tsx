import { Modal } from "@/features/ui/components/shared/Modal";
import { useState, useEffect } from "react";
import type { Room } from "@/shared/types";

interface RoomSettingsModalProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
  onSave: (settings: {
    name: string;
    description: string;
    isPrivate: boolean;
    isHidden: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export default function RoomSettingsModal({
  open,
  onClose,
  room,
  onSave,
  isLoading = false,
}: RoomSettingsModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Initialize form with room data when modal opens
  useEffect(() => {
    if (open && room) {
      setName(room.name);
      setDescription(room.description || "");
      setIsPrivate(room.isPrivate);
      setIsHidden(room.isHidden);
    }
  }, [open, room]);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        isHidden,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update room settings:", error);
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (room) {
      setName(room.name);
      setDescription(room.description || "");
      setIsPrivate(room.isPrivate);
      setIsHidden(room.isHidden);
    }
    onClose();
  };

  if (!room) return null;

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && handleCancel()}
      title="Room Settings"
      okText={isLoading ? "Saving..." : "Save Changes"}
      cancelText="Cancel"
      onOk={handleSave}
      onCancel={handleCancel}
      showOkButton={!!name.trim() && !isLoading}
      showCancelButton={!isLoading}
      allowClose={!isLoading}
      size="xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label" htmlFor="roomName">
              Room Name
            </label>
            <input
              id="roomName"
              type="text"
              placeholder="Enter room name"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="roomDescription">
              Description (Optional)
            </label>
            <textarea
              id="roomDescription"
              placeholder="Describe your room..."
              className="textarea textarea-bordered w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
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
                disabled={isLoading}
              />
              <div className="flex flex-col">
                <span className="label-text select-none">Private Room</span>
                <p className="text-sm text-base-content/50">
                  Band members need approval to join
                </p>
                {!room.isPrivate && isPrivate && (
                  <p className="text-sm text-warning mt-1">
                    ⚠️ Making room private will require approval for new band members
                  </p>
                )}
                {room.isPrivate && !isPrivate && (
                  <p className="text-sm text-info mt-1">
                    ℹ️ Making room public will allow anyone to join as band member
                  </p>
                )}
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
                disabled={isLoading}
              />
              <div className="flex flex-col">
                <span className="label-text select-none">Hidden Room</span>
                <p className="text-sm text-base-content/50">
                  Room won't appear in the public list
                </p>
                {!room.isHidden && isHidden && (
                  <p className="text-sm text-warning mt-1">
                    ⚠️ Hiding room will remove it from the lobby list
                  </p>
                )}
                {room.isHidden && !isHidden && (
                  <p className="text-sm text-info mt-1">
                    ℹ️ Showing room will make it visible in the lobby list
                  </p>
                )}
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
        </div>
      </form>
    </Modal>
  );
}
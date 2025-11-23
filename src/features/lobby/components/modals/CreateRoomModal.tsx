import { Modal } from "@/features/ui";

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  roomName: string;
  roomDescription: string;
  roomType: "perform" | "arrange";
  isPrivate: boolean;
  isHidden: boolean;
  onRoomNameChange: (value: string) => void;
  onRoomDescriptionChange: (value: string) => void;
  onRoomTypeChange: (value: "perform" | "arrange") => void;
  onIsPrivateChange: (value: boolean) => void;
  onIsHiddenChange: (value: boolean) => void;
}

export function CreateRoomModal({
  open,
  onClose,
  onSubmit,
  roomName,
  roomDescription,
  roomType,
  isPrivate,
  isHidden,
  onRoomNameChange,
  onRoomDescriptionChange,
  onRoomTypeChange,
  onIsPrivateChange,
  onIsHiddenChange,
}: CreateRoomModalProps) {
  return (
    <Modal
      open={open}
      setOpen={onClose}
      title="Create New Room"
      onCancel={onClose}
      onOk={onSubmit}
      okText="Create Room"
      cancelText="Cancel"
      showOkButton={!!roomName.trim()}
      size="xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label" htmlFor="newRoomName">
              Room Name
            </label>
            <input
              id="newRoomName"
              type="text"
              placeholder="Enter room name"
              className="input input-bordered w-full"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="newRoomDescription">
              Description (Optional)
            </label>
            <textarea
              id="newRoomDescription"
              placeholder="Describe your room..."
              className="textarea textarea-bordered w-full"
              value={roomDescription}
              onChange={(e) => onRoomDescriptionChange(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-control">
            <label className="label">Room Type</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`card cursor-pointer transition-all ${roomType === "perform" ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300"}`}
                onClick={() => onRoomTypeChange("perform")}
              >
                <div className="card-body p-4">
                  <h4 className="card-title text-sm">Perform Room</h4>
                  <p className="text-xs opacity-70">
                    Real-time jamming with instruments and voice chat
                  </p>
                </div>
              </div>
              <div
                className={`card cursor-pointer transition-all ${roomType === "arrange" ? "bg-secondary text-secondary-content" : "bg-base-200 hover:bg-base-300"}`}
                onClick={() => onRoomTypeChange("arrange")}
              >
                <div className="card-body p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="card-title text-sm">Arrange Room</h4>
                    <div className="badge badge-sm badge-outline">New</div>
                  </div>
                  <p className="text-xs opacity-70">
                    Multi-track arrangement with asynchronous editing
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer flex items-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={isPrivate}
                onChange={(e) => onIsPrivateChange(e.target.checked)}
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
                onChange={(e) => onIsHiddenChange(e.target.checked)}
              />
              <div className="flex flex-col">
                <span className="label-text select-none">Hidden Room</span>
                <p className="text-sm text-base-content/50">
                  Room won't appear in the public list
                </p>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

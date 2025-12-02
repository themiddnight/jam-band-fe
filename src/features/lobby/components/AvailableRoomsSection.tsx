import { RoomItem } from "./rooms";

interface AvailableRoomsSectionProps {
  rooms: any[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string, role: "band_member" | "audience") => void;
  isConnecting: boolean;
  connectionState: any;
}

export function AvailableRoomsSection({
  rooms,
  loading,
  searchQuery,
  onSearchChange,
  onRefresh,
  onCreateRoom,
  onJoinRoom,
  isConnecting,
  connectionState,
}: AvailableRoomsSectionProps) {
  return (
    <div className="card bg-base-100 shadow-xl mb-4 h-full">
      <div className="card-body">
        <div className="flex justify-between items-center mb-3">
          <h2 className="card-title">Available Rooms</h2>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              className="btn btn-sm btn-outline"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={onCreateRoom}
              className="btn btn-sm btn-primary"
            >
              Create
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="form-control mb-3">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <svg
              className="h-[1em] opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <g
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeWidth="2.5"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </g>
            </svg>
            <input
              type="search"
              className="grow"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
        </div>

        {/* Room List */}
        <div className="flex flex-col gap-4">
          {rooms.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <p>No rooms available</p>
              <p className="text-sm">Create a room to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room: any) => (
                <RoomItem
                  key={room.id}
                  room={room}
                  onJoinRoom={onJoinRoom}
                  isConnecting={isConnecting}
                  connectionState={connectionState}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


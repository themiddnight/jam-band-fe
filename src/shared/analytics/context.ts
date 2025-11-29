import type { Room } from "@/shared/types";
import type { RoomContext } from "./events";

export function getRoomContext(room: Room | null | undefined): RoomContext {
  if (!room) {
    return {};
  }

  return {
    roomId: room.id,
    roomType: room.roomType,
    projectId: room.roomType === "arrange" ? room.id : undefined,
  };
}

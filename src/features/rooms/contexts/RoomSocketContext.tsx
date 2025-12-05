import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

interface RoomSocketContextType {
  socket: Socket | null;
}

export const RoomSocketContext = createContext<RoomSocketContextType | null>(null);

import { memo, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { RoomSocketContext } from './RoomSocketContext';

interface RoomSocketProviderProps {
  socket: Socket | null;
  children: ReactNode;
}

export const RoomSocketProvider = memo(({ socket, children }: RoomSocketProviderProps) => {
  return (
    <RoomSocketContext.Provider value={{ socket }}>
      {children}
    </RoomSocketContext.Provider>
  );
});

RoomSocketProvider.displayName = 'RoomSocketProvider';

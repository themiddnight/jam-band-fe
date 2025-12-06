import { useContext } from 'react';
import { RoomSocketContext } from '../contexts/RoomSocketContext';

export const useRoomSocketContext = () => {
  const context = useContext(RoomSocketContext);
  if (!context) {
    // throw new Error('useRoomSocketContext must be used within a RoomSocketProvider');
    // Allow null for components that might be used outside of provider but handle null socket gracefully
    return { socket: null };
  }
  return context;
};

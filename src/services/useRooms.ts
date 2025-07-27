import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoomList, getHealthCheck, leaveRoom } from './api';
import type { RoomListResponse, LeaveRoomResponse } from './api';

// Query keys for caching
export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (filters: string) => [...roomKeys.lists(), { filters }] as const,
  details: () => [...roomKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
};

export function useRoomQuery() {
  const queryClient = useQueryClient();

  const healthCheckQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealthCheck,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const roomsQuery = useQuery<RoomListResponse>({
    queryKey: roomKeys.lists(),
    queryFn: getRoomList,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const roomLeaveMutate = useMutation<LeaveRoomResponse, Error, { roomId: string; userId: string }>({
    mutationFn: ({ roomId, userId }) => leaveRoom(roomId, userId),
    onSuccess: (data) => {
      // Invalidate room list to refresh the lobby
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      
      console.log('Successfully left room:', data.message);
    },
    onError: (error) => {
      console.error('Failed to leave room:', error);
    },
  });

  return {
    healthCheckQuery,
    roomsQuery,
    roomLeaveMutate,
  };
} 
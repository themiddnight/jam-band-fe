import { useQuery } from '@tanstack/react-query';
import { getRoomList, getHealthCheck } from './api';
import type { RoomListResponse } from './api';

// Query keys for caching
export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (filters: string) => [...roomKeys.lists(), { filters }] as const,
  details: () => [...roomKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
};

// Custom hook for fetching room list
export const useRooms = () => {
  return useQuery<RoomListResponse>({
    queryKey: roomKeys.lists(),
    queryFn: getRoomList,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

// Custom hook for health check
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealthCheck,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}; 
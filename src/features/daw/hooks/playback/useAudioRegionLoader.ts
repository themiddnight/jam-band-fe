import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { useRegionStore } from '../../stores/regionStore';
import { useRoomStore } from '@/features/rooms';

const appendUserQuery = (url: string, userId?: string | null): string => {
  if (!userId) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}userId=${encodeURIComponent(userId)}`;
};

export const useAudioRegionLoader = (): void => {
  const regions = useRegionStore((state) => state.regions);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const currentUserId = useRoomStore((state) => state.currentUser?.id);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    regions.forEach((region) => {
      if (region.type !== 'audio') {
        return;
      }
      if (!region.audioUrl || region.audioBuffer) {
        return;
      }
      if (loadingRef.current.has(region.id)) {
        return;
      }

      loadingRef.current.add(region.id);

      const fetchAudioBuffer = async () => {
        try {
          const response = await fetch(appendUserQuery(region.audioUrl!, currentUserId));
          if (!response.ok) {
            throw new Error(`Failed to load audio region ${region.id}: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = Tone.getContext().rawContext as AudioContext;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          updateRegion(region.id, { audioBuffer });
        } catch (error) {
          console.error('Failed to fetch audio region buffer', {
            regionId: region.id,
            error,
          });
        } finally {
          loadingRef.current.delete(region.id);
        }
      };

      void fetchAudioBuffer();
    });
  }, [regions, currentUserId, updateRegion]);
};


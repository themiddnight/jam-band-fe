import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DAWSyncService } from '../dawSyncService';
import { TrackService } from '../trackService';
import { SocketMessageQueue } from '@/shared/utils/SocketMessageQueue';

// Mock services
vi.mock('../trackService', () => ({
  TrackService: {
    syncAddTrack: vi.fn(),
    syncUpdateTrack: vi.fn(),
    syncRemoveTrack: vi.fn(),
    detachRegionFromTrack: vi.fn(),
    attachRegionToTrack: vi.fn(),
    getTracks: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../regionService', () => ({
  RegionService: {
    syncAddRegion: vi.fn(),
    syncUpdateRegion: vi.fn(),
    getRegions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../recordingService', () => ({
  RecordingService: {
    removeRemoteRecordingPreview: vi.fn(),
  },
}));

// Mock SocketMessageQueue
let mockQueueInstance: any;
vi.mock('@/shared/utils/SocketMessageQueue', () => {
  return {
    SocketMessageQueue: vi.fn().mockImplementation(() => {
      mockQueueInstance = {
        enqueue: vi.fn(),
        clear: vi.fn(),
      };
      return mockQueueInstance;
    }),
  };
});

describe('DAWSyncService', () => {
  let service: DAWSyncService;
  let mockSocket: any;

  beforeEach(() => {
    service = new DAWSyncService();
    mockSocket = {
      id: 'socket-123',
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      connected: true,
      nsp: '/',
    };
    
    // Reset mocks
    vi.clearAllMocks();
    mockQueueInstance = undefined;
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should initialize and setup event listeners', () => {
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');

    expect(mockSocket.on).toHaveBeenCalledWith('arrange:track_added', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('arrange:region_moved', expect.any(Function));
    // Check for queue initialization
    expect(SocketMessageQueue).toHaveBeenCalled();
  });

  it('should emit outgoing track add event', () => {
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');
    const mockTrack = { id: 't1', name: 'Track 1' } as any;

    service.syncTrackAdd(mockTrack);

    expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_add', {
      roomId: 'room-1',
      track: mockTrack,
    });
  });

  it('should handle incoming track added event', () => {
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');
    
    // Get the registered callback
    const callback = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'arrange:track_added')?.[1];
    expect(callback).toBeDefined();

    const payload = { track: { id: 't2' }, userId: 'user-2' };
    callback(payload);

    expect(TrackService.syncAddTrack).toHaveBeenCalledWith(payload.track);
  });

  it('should ignore incoming events from self', () => {
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');
    
    const callback = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'arrange:track_added')?.[1];
    
    const payload = { track: { id: 't1' }, userId: 'user-1' }; // Same userId as initialized
    callback(payload);

    expect(TrackService.syncAddTrack).not.toHaveBeenCalled();
  });

  it('should batch synth param updates using message queue', () => {
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');
    
    expect(mockQueueInstance).toBeDefined();
    
    const params = { volume: 0.8 };
    service.syncSynthParams('t1', params);

    expect(mockQueueInstance.enqueue).toHaveBeenCalledWith('arrange:synth_params_update', {
      roomId: 'room-1',
      trackId: 't1',
      params,
    });
    
    // Should NOT emit directly via socket
    expect(mockSocket.emit).not.toHaveBeenCalledWith('arrange:synth_params_update', expect.anything());
  });

  it('should not process incoming events when syncing flag is set (loop prevention)', () => {
    // This is tricky to test because isSyncing is private and set inside the methods.
    // But we can infer it works if we simulate a scenario where we might recursively call things?
    // Actually, the best way to test isSyncing logic is to trust the implementation or expose it.
    // However, we can test that `syncTrackAdd` (outgoing) doesn't emit if `isSyncing` is true.
    // But we can't easily set `isSyncing` from outside.
    // We can skip this specific internal state test for now or use `any` casting if really needed.
    
    service.initialize(mockSocket, 'room-1', 'user-1', 'User 1');
    
    // Cast to any to set private property
    (service as any).isSyncing = true;
    
    service.syncTrackAdd({ id: 't1' } as any);
    
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});

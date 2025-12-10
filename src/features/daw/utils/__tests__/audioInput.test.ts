import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Tone from 'tone';
import { getOrCreateUserMedia, getUserMedia, closeUserMedia } from '../audioInput';

// Mock Tone.js
vi.mock('tone', () => ({
  getContext: vi.fn(() => ({
    rawContext: {
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    }
  })),
  UserMedia: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    close: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('audioInput', () => {
  let mockStream: any;
  let mockTrack: any;

  beforeEach(() => {
    // Reset singleton state
    closeUserMedia();

    // Mock MediaStream
    mockTrack = {
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({ deviceId: 'default-device' }),
      label: 'Default Input',
    };

    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
      getAudioTracks: vi.fn().mockReturnValue([mockTrack]),
      active: true,
    };

    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getOrCreateUserMedia should create a new stream if none exists', async () => {
    const streamNode = await getOrCreateUserMedia();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.objectContaining({
        deviceId: undefined
      })
    }));
    expect(streamNode).toBeDefined();
  });

  it('getOrCreateUserMedia should request specific deviceId', async () => {
    await getOrCreateUserMedia('specific-mic-id');

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.objectContaining({
        deviceId: { exact: 'specific-mic-id' }
      })
    }));
  });

  it('getOrCreateUserMedia should recreate stream if deviceId changes', async () => {
    // First call with default
    await getOrCreateUserMedia();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    // Second call with new device
    await getOrCreateUserMedia('new-mic-id');

    // Should stop old tracks
    expect(mockTrack.stop).toHaveBeenCalled();
    // Should call gUM again
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      audio: expect.objectContaining({
        deviceId: { exact: 'new-mic-id' }
      })
    }));
  });

  it('getOrCreateUserMedia should reuse stream if deviceId is same', async () => {
    // First call
    await getOrCreateUserMedia('same-mic-id');

    // Reset mocks to track subsequent calls
    vi.clearAllMocks();

    // Second call same ID
    await getOrCreateUserMedia('same-mic-id');

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(mockTrack.stop).not.toHaveBeenCalled();
  });

  it('closeUserMedia should stop all tracks', async () => {
    await getOrCreateUserMedia();
    closeUserMedia();

    expect(mockTrack.stop).toHaveBeenCalled();
    const currentFromGetter = getUserMedia();
    expect(currentFromGetter).toBeFalsy();
  });
});

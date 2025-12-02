import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Footer } from "@/features/ui";
import { ChatBox, useAudienceRoom } from "@/features/rooms";
import Hls from "hls.js";

/**
 * Audience Room page - Radio-style listening experience with HLS streaming
 * 
 * Uses HLS.js to play the live audio stream from the room owner.
 * The backend transcodes WebM/Opus to HLS using FFmpeg.
 */
const AudienceRoom = memo(() => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const {
    currentRoom,
    currentUser,
    isConnected,
    isConnecting,
    error,
    isBroadcasting,
    playlistUrl,
    sendChatMessage,
    handleLeaveRoom,
  } = useAudienceRoom({ roomId: roomId || "" });

  const [volume, setVolume] = useState(0.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'buffering' | 'playing' | 'error'>('connecting');
  const [streamError, setStreamError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Initialize HLS player when playlist URL is available
  useEffect(() => {
    if (!playlistUrl || !isBroadcasting) {
      setStreamStatus('connecting');
      return;
    }

    // Build full URL with API base
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    const fullPlaylistUrl = playlistUrl.startsWith('http')
      ? playlistUrl
      : `${apiBaseUrl}${playlistUrl}`;

 
    // Create audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    // Cleanup existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        // Reduce polling frequency
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 10000,
        fragLoadingTimeOut: 20000,
      });

      hls.loadSource(fullPlaylistUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStreamStatus('buffering');
        setStreamError(null);

        // Auto-play
        audio.play()
          .then(() => {
            setIsPlaying(true);
            setStreamStatus('playing');
          })
          .catch((err) => {
            console.warn("Auto-play blocked:", err);
            setStreamStatus('buffering');
          });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Don't change status to avoid re-triggering effect
              setTimeout(() => hls.startLoad(), 2000); // Retry after 2 seconds
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              console.error("🔴 HLS fatal error:", data);
              setStreamStatus('error');
              setStreamError('Stream playback failed');
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setStreamStatus('playing');
        setIsPlaying(true);
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      audio.src = fullPlaylistUrl;
      audio.addEventListener('loadedmetadata', () => {
        setStreamStatus('buffering');
        audio.play()
          .then(() => {
            setIsPlaying(true);
            setStreamStatus('playing');
          })
          .catch(() => setStreamStatus('buffering'));
      });
    } else {
      setStreamStatus('error');
      setStreamError('HLS not supported in this browser');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistUrl, isBroadcasting]); // Removed volume and streamStatus to prevent re-fetching

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, []);

  // Handle manual play (for browsers that block autoplay)
  const handlePlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setStreamStatus('playing');
        })
        .catch((err) => {
          console.error("Play failed:", err);
          setStreamError('Failed to play audio');
        });
    }
  }, []);

  // Handle leave room
  const handleLeave = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    handleLeaveRoom();
    navigate("/");
  }, [handleLeaveRoom, navigate]);

  // Render connecting state
  if (isConnecting || (!isConnected && !currentRoom)) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl">
              Connecting to Room
            </h2>
            <p className="text-base-content/70 mb-4">
              Joining as audience...
            </p>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <div className="card-actions justify-center mt-4">
              <button onClick={() => navigate("/")} className="btn btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl text-error">
              Error
            </h2>
            <p className="text-base-content/70 mb-4">{error}</p>
            <div className="card-actions justify-center">
              <button onClick={() => navigate("/")} className="btn btn-primary">
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render not broadcasting state
  if (!isBroadcasting) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl">
              Waiting for Broadcast
            </h2>
            <p className="text-base-content/70 mb-4">
              The room owner hasn't started broadcasting yet. Please wait...
            </p>
            <div className="loading loading-dots mx-auto loading-lg text-primary"></div>
            <div className="card-actions justify-center mt-4">
              <button onClick={handleLeave} className="btn btn-outline">
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <div className="flex-1 p-3">
        <div className="flex flex-col items-center">
          {/* Room Header */}
          <div className="w-full  mb-4">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-success">
                  Audience
                </h2>
                <span className="badge badge-xs sm:badge-sm badge-primary">
                  {currentRoom?.name}
                </span>

                <div className='divider divider-horizontal !m-0' />

                {/* User Name and Role */}
                <div className="flex items-center">
                  <span className="text-sm mr-2">
                    {currentUser?.username}
                  </span>
                  <span className="text-sm text-base-content/50">
                    Audience
                  </span>
                </div>
              </div>
              <button
                onClick={handleLeave}
                className="btn btn-outline btn-xs"
              >
                Leave Room
              </button>
            </div>
          </div>

          {/* Radio-style Live Indicator */}
          <div className="w-full  mb-4">
            <div className="card bg-gradient-to-r from-primary/20 to-secondary/20 shadow-xl">
              <div className="card-body items-center text-center py-8">
                {/* Animated Radio Icon */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex items-center mt-4">
                  <h3 className="text-xl font-semibold">{currentRoom?.name}</h3>

                  <div className="divider divider-horizontal !m-0" />

                  <h3 className="text-xl font-semibold">
                    {streamStatus === 'playing' ? 'Now Playing' :
                      streamStatus === 'buffering' ? 'Buffering...' :
                        streamStatus === 'connecting' ? 'Connecting...' : 'Stream Error'}
                  </h3>
                </div>
                {/* <p className="text-base-content/70">
                  Live performance from {currentRoom?.name}
                </p> */}

                {/* Error message */}
                {streamError && (
                  <div className="alert alert-error mt-2">
                    <span>{streamError}</span>
                  </div>
                )}

                {/* Play button for autoplay-blocked browsers */}
                {streamStatus === 'buffering' && !isPlaying && (
                  <button
                    onClick={handlePlay}
                    className="btn btn-primary btn-lg mt-4"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                    Start Listening
                  </button>
                )}

                {/* Volume Control */}
                <div className="flex items-center gap-3 w-full max-w-xs mt-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="range range-primary range-sm flex-1"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>

                {/* Status */}
                <div className={`flex items-center gap-2 text-sm mt-2 ${streamStatus === 'playing' ? 'text-success' :
                  streamStatus === 'error' ? 'text-error' : 'text-warning'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${streamStatus === 'playing' ? 'bg-success animate-pulse' :
                    streamStatus === 'error' ? 'bg-error' : 'bg-warning animate-pulse'
                    }`}></span>
                  {streamStatus === 'playing' ? 'Listening live' :
                    streamStatus === 'buffering' ? 'Buffering stream...' :
                      streamStatus === 'connecting' ? 'Connecting to stream...' : 'Stream unavailable'}
                </div>
              </div>
            </div>
          </div>

          {/* Chat and Users Section */}
          <div className="w-full  flex flex-col-reverse lg:flex-row gap-3">
            {/* Users List Panel */}
            <div className="flex-3">
              <div className="card bg-base-100 shadow-xl h-full">
                <div className="card-body p-4">
                  <h3 className="card-title text-lg mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Users ({currentRoom?.users?.length || 0})
                  </h3>

                  {/* Musicians Section */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-base-content/70 mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      Musicians
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {currentRoom?.users
                        ?.filter(user => user.role === 'room_owner' || user.role === 'band_member')
                        .map(user => (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-base-200/50"
                          >
                            {/* Role Icon */}
                            {user.role === 'room_owner' ? (
                              <span className="text-warning" title="Room Owner">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-primary" title="Band Member">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </span>
                            )}
                            <span className="text-sm truncate flex-1">{user.username}</span>
                            {user.currentInstrument && (
                              <span className="text-xs text-base-content/50">
                                {user.currentInstrument}
                              </span>
                            )}
                          </div>
                        ))}
                      {!currentRoom?.users?.some(u => u.role === 'room_owner' || u.role === 'band_member') && (
                        <p className="text-sm text-base-content/50 italic p-2">No musicians</p>
                      )}
                    </div>
                  </div>

                  {/* Audience Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-base-content/70 mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Audience ({currentRoom?.users?.filter(u => u.role === 'audience').length || 0})
                    </h4>
                    <div className="flex gap-2 space-y-1 max-h-40 overflow-y-auto">
                      {currentRoom?.users
                        ?.filter(user => user.role === 'audience')
                        .map(user => (
                          <div
                            key={user.id}
                            className={`w-fit flex items-center gap-2 p-2 rounded-lg ${user.id === currentUser?.id ? 'bg-primary/10 border border-primary/30' : 'bg-base-200/50'
                              }`}
                          >
                            <span className="text-base-content/50">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </span>
                            <span className="text-sm truncate flex-1">
                              {user.username}
                              {user.id === currentUser?.id && (
                                <span className="text-xs text-primary ml-1">(you)</span>
                              )}
                            </span>
                          </div>
                        ))}
                      {!currentRoom?.users?.some(u => u.role === 'audience') && (
                        <p className="text-sm text-base-content/50 italic p-2">No audience yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Box - Takes 2 columns on large screens */}
            <div className="flex-4">
              <ChatBox
                currentUserId={currentUser?.id || ""}
                onSendMessage={sendChatMessage}
              />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
});

AudienceRoom.displayName = "AudienceRoom";

export default AudienceRoom;

import { memo } from "react";
import { VoiceInput } from "@/features/audio";
import { ArrangeRoomMembers } from "@/features/rooms";
import { BroadcastToggle } from "./BroadcastToggle";
import type { RoomUser } from "@/shared/types";

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

interface BroadcastUser {
  userId: string;
  username: string;
  trackId: string;
}

export interface CollaboratorsProps {
  // Voice input props
  isVoiceEnabled?: boolean;
  canTransmitVoice?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
  onMuteStateChange?: (isMuted: boolean) => void;
  rtcLatency?: number | null;
  rtcLatencyActive?: boolean;
  browserAudioLatency?: number;
  meshLatency?: number | null;
  isConnecting?: boolean;
  connectionError?: boolean;
  onConnectionRetry?: () => void;
  userCount?: number;
  // Room members props (simplified for ArrangeRoom)
  roomUsers?: RoomUser[];
  voiceUsers?: VoiceUser[];
  broadcastUsers?: BroadcastUser[];
  voiceMuteStates?: Record<string, boolean>;
  // Broadcast props
  onBroadcastChange?: (broadcasting: boolean, trackId: string | null) => void;
}

export const Collaborators = memo(({
  isVoiceEnabled = false,
  canTransmitVoice = false,
  onStreamReady,
  onStreamRemoved,
  onMuteStateChange,
  rtcLatency,
  rtcLatencyActive = false,
  browserAudioLatency,
  meshLatency,
  isConnecting = false,
  connectionError = false,
  onConnectionRetry,
  userCount = 0,
  roomUsers = [],
  voiceUsers = [],
  broadcastUsers = [],
  voiceMuteStates = {},
  onBroadcastChange,
}: CollaboratorsProps) => {

  return (
    <div className="flex flex-col gap-4 p-4">
      
      <div className="flex flex-col gap-4">
        {/* Current user */}

        {/* Voice Input - Mic Input */}
        {isVoiceEnabled && canTransmitVoice && (
          <div className="border border-base-300">
            <VoiceInput
              isVisible={true}
              onStreamReady={onStreamReady}
              onStreamRemoved={onStreamRemoved}
              onMuteStateChange={onMuteStateChange}
              rtcLatency={rtcLatency}
              rtcLatencyActive={rtcLatencyActive}
              userCount={userCount}
              browserAudioLatency={browserAudioLatency}
              meshLatency={meshLatency}
              isConnecting={isConnecting}
              connectionError={connectionError}
              onConnectionRetry={onConnectionRetry}
            />
          </div>
        )}

        {/* Broadcast Toggle - Instrument Broadcasting */}
        <div className="border border-base-300">
          <BroadcastToggle onBroadcastChange={onBroadcastChange} />
        </div>

        {/* Room Members */}
        {roomUsers.length > 0 && (
          <div className="border border-base-300 p-3">
            <ArrangeRoomMembers
              users={roomUsers}
              voiceUsers={voiceUsers}
              broadcastUsers={broadcastUsers}
              voiceMuteStates={voiceMuteStates}
            />
          </div>
        )}
      </div>
    </div>
  );
});
Collaborators.displayName = 'Collaborators';


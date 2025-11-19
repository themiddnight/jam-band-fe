import { memo } from "react";
import { VoiceInput } from "@/features/audio";
import { ArrangeRoomMembers } from "@/features/rooms";
import type { RoomUser } from "@/shared/types";

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

export interface CollaboratorsProps {
  // Voice input props
  isVoiceEnabled?: boolean;
  canTransmitVoice?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
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
}

export const Collaborators = memo(({
  isVoiceEnabled = false,
  canTransmitVoice = false,
  onStreamReady,
  onStreamRemoved,
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
}: CollaboratorsProps) => {

  return (
    <div className="flex flex-col gap-4 p-4">
      
      <div className="flex flex-col gap-4">
        {/* Current user */}

        {/* Voice Input - Mic Input */}
        {isVoiceEnabled && canTransmitVoice && (
          <div className="border-t border-base-300 pt-4">
            <VoiceInput
              isVisible={true}
              onStreamReady={onStreamReady}
              onStreamRemoved={onStreamRemoved}
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

        {/* Room Members */}
        {roomUsers.length > 0 && (
          <div className="border-t border-base-300 pt-4">
            <ArrangeRoomMembers
              users={roomUsers}
              voiceUsers={voiceUsers}
            />
          </div>
        )}
      </div>
    </div>
  );
});
Collaborators.displayName = 'Collaborators';


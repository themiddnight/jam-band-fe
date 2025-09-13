import PlayingIndicator from "./PlayingIndicator";
import UserActionsMenu from "./UserActionsMenu";
import PendingSwapStatus from "./PendingSwapStatus";
import { getInstrumentIcon } from "@/shared/constants/instruments";
import { useUserStore } from "@/shared/stores";
import type { RoomUser } from "@/shared/types";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash/debounce";
import { getGlobalMixer, getOrCreateGlobalMixer } from "@/features/audio/utils/effectsArchitecture";
import { dbToGain, gainToDb, formatDb, applyFastAttackSlowRelease, DEFAULT_METER_RELEASE } from "@/features/audio/utils/audioUtils";

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

interface RoomMembersProps {
  users: RoomUser[];
  pendingMembers: RoomUser[];
  playingIndicators: Map<string, { velocity: number; timestamp: number }>;
  voiceUsers?: VoiceUser[];
  onApproveMember: (userId: string) => void;
  onRejectMember: (userId: string) => void;
  onSwapInstrument: (targetUserId: string) => void;
  onKickUser: (targetUserId: string) => void;
  pendingSwapTarget?: RoomUser | null;
  onCancelSwap?: () => void;
}

const RoomMembers = memo(
  ({
    users,
    playingIndicators,
    voiceUsers = [],
    onSwapInstrument,
    onKickUser,
    pendingSwapTarget,
    onCancelSwap
  }: RoomMembersProps) => {
    const { userId: currentUserId } = useUserStore();

    const sortedUsers = users.slice().sort((a, b) => {
      const roleOrder = {
        room_owner: 0,
        band_member: 1,
        audience: 2,
      } as const;
      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
    });

    // Get current user's role for permission checks
    const currentUser = users.find(user => user.id === currentUserId);
    const currentUserRole = currentUser?.role || "";

    // Reset signal for child sliders
    const [resetSignal, setResetSignal] = useState(0);

    const handleResetAllVolumes = async () => {
      const mixer = getGlobalMixer() || (await getOrCreateGlobalMixer());
      for (const u of users) {
        if (!mixer.getChannel(u.id)) {
          mixer.createUserChannel(u.id, u.username);
        }
        mixer.setUserVolume(u.id, dbToGain(0));
      }
      setResetSignal((s) => s + 1);
    };

    return (
      <div className="card bg-base-100 shadow-lg w-full">
        <div className="card-body p-3">
          <div className="flex items-center justify-between">
            <h3 className="card-title">Room Members</h3>
            <button className="btn btn-xs" onClick={handleResetAllVolumes} aria-label="reset-all-volumes">Reset</button>
          </div>
          {/* Active Members - Compact List */}
          <div className="flex flex-wrap gap-2">
            {sortedUsers.map((user) => {
              const playingIndicator = playingIndicators.get(user.id);
              const voiceUser = voiceUsers.find((v) => v.userId === user.id);
              const isCurrentUser = user.id === currentUserId;
              const hasPendingSwap = pendingSwapTarget && user.id === pendingSwapTarget.id;

              return (
                <div className="flex flex-col items-center gap-2 p-2 bg-base-200 rounded-lg  w-full border-2"
                  style={{
                    borderColor:
                      voiceUser?.audioLevel && voiceUser.audioLevel > 0.01
                        ? "hsl(30, 100%, 60%)"
                        : "transparent",
                  }}>
                  <div
                    key={user.id}
                    className="flex justify-between items-center min-w-fit w-full"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {user.role === "room_owner" && <div>👑</div>}
                      {user.role !== "audience" && (
                        <PlayingIndicator
                          velocity={playingIndicator?.velocity || 0}
                          mode="pulse"
                        />
                      )}
                      {voiceUser?.isMuted && user.role !== "audience" && "🔇"}

                      {/* Username or Pending Status */}
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm whitespace-nowrap">
                          {user.username}
                        </span>
                      </div>

                      <div className="flex gap-2 text-xs whitespace-nowrap">
                        {user.role === "band_member" ||
                          user.role === "room_owner" ? (
                          user.currentInstrument ? (
                            getInstrumentIcon(user.currentInstrument)
                          ) : (
                            <div>🎸</div>
                          )
                        ) : (
                          <div>👥</div>
                        )}
                      </div>
                      {user.role !== "audience" && user.currentInstrument ? (
                        <span className="text-xs text-base-content/60 bg-base-300 px-2 py-1 rounded whitespace-nowrap">
                          {user.currentInstrument.replace(/_/g, " ")}
                        </span>
                      ) : null}
                      {hasPendingSwap && onCancelSwap && (
                        <PendingSwapStatus
                          targetUser={pendingSwapTarget}
                          onCancel={onCancelSwap}
                        />
                      )}
                    </div>

                    {/* User Actions Menu - only for other users */}
                    {!isCurrentUser && (
                      <UserActionsMenu
                        user={user}
                        currentUserRole={currentUserRole}
                        onSwapInstrument={onSwapInstrument}
                        onKickUser={onKickUser}
                      />
                    )}
                  </div>
                  {/* Unified per-user volume + meter */}
                  <UserVolumeControls userId={user.id} userRole={user.role} resetSignal={resetSignal} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

RoomMembers.displayName = "RoomMembers";

function UserVolumeControls({ userId, userRole, resetSignal }: { userId: string; userRole: string; resetSignal?: number }) {
  const [volumeDb, setVolumeDb] = useState<number>(0); // 0dB = unity gain
  const [level, setLevel] = useState<number>(0);
  const [release, setRelease] = useState<number>(DEFAULT_METER_RELEASE);
  // Keep setter referenced to avoid lint warning when the control is commented out
  useEffect(() => { return () => void setRelease; }, []);
  const rafRef = useRef<number | null>(null);
  const mixerRef = useRef<any>(getGlobalMixer());
  const lastUpdateRef = useRef<number>(0);

  // Respond to global reset
  useEffect(() => {
    if (typeof resetSignal === "undefined") return;
    (async () => {
      const mixer = mixerRef.current || (await getOrCreateGlobalMixer());
      mixerRef.current = mixer;
      mixer.setUserVolume(userId, dbToGain(0));
      setVolumeDb(0);
    })();
  }, [resetSignal, userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Ensure mixer exists and channel is present
      const mixer = mixerRef.current || (await getOrCreateGlobalMixer());
      mixerRef.current = mixer;
      if (!mixer.getChannel(userId)) {
        mixer.createUserChannel(userId, userId);
      }
      const currentGain = mixer.getUserVolume(userId);
      if (mounted && typeof currentGain === "number") {
        const currentDb = gainToDb(currentGain);
        setVolumeDb(currentDb);
      }

      const tick = () => {
        try {
          const now = performance.now();
          if (now - lastUpdateRef.current >= 33) { // ~30 FPS
            lastUpdateRef.current = now;
            const mx = mixerRef.current;
            if (mx && !mx.getChannel(userId)) {
              mx.createUserChannel(userId, userId);
            }
            const lvl = mx ? mx.getUserOutputLevel(userId) : null;
            if (mounted && typeof lvl === "number") {
              setLevel((prev) => {
                const next = applyFastAttackSlowRelease(prev, lvl, release);
                return Math.abs(next - prev) > 0.002 ? next : prev; // skip tiny updates
              });
            }
          }
        } catch {
          // ignore transient errors while mixer/context reinitializes
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    })();
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [userId, release]);

  // Debounce mixer volume writes
  const applyGainDebounced = useMemo(() => debounce((uid: string, gainValue: number) => {
    const mx = mixerRef.current || getGlobalMixer();
    if (mx) mx.setUserVolume(uid, gainValue);
  }, 25), []);
  useEffect(() => {
    return () => {
      applyGainDebounced.cancel();
    };
  }, [applyGainDebounced]);

  const onChange = useMemo(
    () =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const dbValue = parseFloat(e.target.value);
        setVolumeDb(dbValue);
        const gainValue = dbToGain(dbValue);
        applyGainDebounced(userId, gainValue);
      },
    [userId, applyGainDebounced],
  );

  // Simple meter bar (0..1)
  const meterWidth = level * 100

  // Role-based color styling
  const getRoleBasedColors = () => {
    if (userRole === "room_owner") {
      return {
        sliderClass: "range-warning",
        meterClass: "bg-warning",
      };
    } else {
      return {
        sliderClass: "range-base-content", // Gray/black for band members
        meterClass: "bg-base-content", // Gray/black meter
      };
    }
  };

  const colors = getRoleBasedColors();

  return (
    <div className="flex items-baseline-last gap-2 w-full">
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="w-full h-1 bg-base-300 rounded overflow-hidden" aria-label="user-meter">
          <div
            className={`h-full ${colors.meterClass}`}
            style={{ width: `${Math.min(100, meterWidth)}%` }}
          />
        </div>
        <div className="flex items-center gap-2 w-full">
          <input
            type="range"
            min={-60}
            max={12}
            step={0.5}
            value={volumeDb}
            onChange={onChange}
            className={`range range-xs w-full ${colors.sliderClass}`}
            aria-label="user-volume"
          />
        </div>
        {/* Optional: release factor control for tuning (hidden by default) */}
        {/* <input type="range" min={0.8} max={0.99} step={0.005} value={release} onChange={(e)=>setRelease(parseFloat(e.target.value))} className="range range-xxs w-full" aria-label="meter-release" /> */}
      </div>
      <span className="text-xs w-12 text-right">{formatDb(volumeDb)}</span>
    </div>
  );
}

export default RoomMembers;

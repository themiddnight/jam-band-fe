import type { RoomType } from "@/shared/types";
import { trackEvent } from "./client";

export interface RoomContext {
  roomId?: string;
  roomType?: RoomType | "lobby";
  projectId?: string;
}

function hasRoomContext(
  context: RoomContext,
): context is Required<Pick<RoomContext, "roomId" | "roomType">> & RoomContext {
  return Boolean(context.roomId && context.roomType);
}

export function trackSessionStart(additional?: Record<string, unknown>) {
  const referrer = typeof document !== "undefined" ? document.referrer : "";
  trackEvent("session_start", {
    payload: {
      entrypoint: referrer ? "external" : "direct",
      referrer: referrer || undefined,
      ...additional,
    },
  });
}

export function trackRoomSessionStart(context: RoomContext) {
  if (!hasRoomContext(context)) return;
  trackEvent("room_session_start", {
    roomId: context.roomId,
    roomType: context.roomType,
    projectId: context.projectId,
  });
}

export function trackRoomSessionEnd(context: RoomContext, durationMs: number) {
  if (!hasRoomContext(context)) return;
  trackEvent("room_session_end", {
    roomId: context.roomId,
    roomType: context.roomType,
    projectId: context.projectId,
    payload: {
      durationMs,
    },
  });
}

export function trackInviteSent(
  context: RoomContext,
  role: "band_member" | "audience",
  channel: "copy" | "share",
) {
  if (!hasRoomContext(context)) return;
  trackEvent("invite_sent", {
    roomId: context.roomId,
    roomType: context.roomType,
    payload: {
      role,
      channel,
    },
  });
}

export function trackProjectSave(context: RoomContext, details?: Record<string, unknown>) {
  trackEvent("project_save", {
    roomId: context.roomId,
    roomType: context.roomType,
    projectId: context.projectId,
    payload: details ?? undefined,
  });
}

export function trackProjectExport(context: RoomContext, details?: Record<string, unknown>) {
  trackEvent("project_export", {
    roomId: context.roomId,
    roomType: context.roomType,
    projectId: context.projectId,
    payload: details ?? undefined,
  });
}

export function trackInstrumentSelected(
  context: RoomContext,
  instrumentId: string,
  category: string,
) {
  if (!hasRoomContext(context)) return;
  trackEvent("instrument_selected", {
    roomId: context.roomId,
    roomType: context.roomType,
    payload: {
      instrumentId,
      category,
    },
  });
}

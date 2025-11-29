import { analyticsConfig, isAnalyticsEnabled } from "./config";
import { getSessionId } from "./session";
import { getDeviceInfo } from "./device";
import type { AnalyticsEventPayload, TrackOptions } from "./types";
import { useUserStore } from "@/shared/stores/userStore";

const pendingEvents: AnalyticsEventPayload[] = [];
const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 4000;
const NETWORK_TIMEOUT_MS = 5000;
let flushTimer: number | null = null;
let listenersAttached = false;
let cachedDevice = getDeviceInfo();

function ensureListeners() {
  if (listenersAttached || typeof window === "undefined") {
    return;
  }

  const flushAndClear = () => {
    void flushEvents(true);
  };

  window.addEventListener("beforeunload", flushAndClear);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushEvents(true);
    }
  });

  listenersAttached = true;
}

function scheduleFlush() {
  if (flushTimer !== null) {
    return;
  }

  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

async function sendWithFetch(events: AnalyticsEventPayload[]) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(analyticsConfig.endpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": analyticsConfig.apiKey!,
      },
      body: JSON.stringify({ events }),
      keepalive: true,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function sendWithBeacon(events: AnalyticsEventPayload[]) {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const payload = JSON.stringify({ events });
  const blob = new Blob([payload], { type: "application/json" });
  return navigator.sendBeacon(analyticsConfig.endpoint!, blob);
}

async function flushEvents(forceBeacon = false) {
  if (!pendingEvents.length || !analyticsConfig.endpoint || !analyticsConfig.apiKey) {
    return;
  }

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const eventsToSend = pendingEvents.splice(0, MAX_BATCH_SIZE);
  const useBeacon = forceBeacon || typeof document !== "undefined" && document.visibilityState === "hidden";

  try {
    if (useBeacon && sendWithBeacon(eventsToSend)) {
      return;
    }

    await sendWithFetch(eventsToSend);
  } catch (error) {
    console.warn("Failed to send analytics events", error);
    pendingEvents.unshift(...eventsToSend);

    if (!forceBeacon) {
      scheduleFlush();
    }
  }
}

export function trackEvent(eventName: string, options: TrackOptions = {}) {
  if (!isAnalyticsEnabled) {
    return;
  }

  const userStore = useUserStore.getState();
  const userId = userStore.userId ?? userStore.ensureUserId();
  const sessionId = options.sessionId ?? getSessionId();

  if (!userId || !sessionId) {
    return;
  }

  if (!cachedDevice) {
    cachedDevice = getDeviceInfo();
  }

  const event: AnalyticsEventPayload = {
    eventName,
    userId,
    sessionId,
    roomId: options.roomId ?? undefined,
    roomType: options.roomType ?? undefined,
    projectId: options.projectId ?? undefined,
    occurredAt: options.occurredAt ?? new Date(),
    payload: options.payload ?? undefined,
    device: options.device ?? cachedDevice ?? undefined,
    network: options.network ?? undefined,
  };

  pendingEvents.push(event);
  ensureListeners();
  scheduleFlush();

  if (pendingEvents.length >= MAX_BATCH_SIZE) {
    void flushEvents();
  }
}

export function flushAnalyticsQueue() {
  void flushEvents();
}

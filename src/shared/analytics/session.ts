import { v4 as uuidv4 } from 'uuid';
let cachedSessionId: string | null = null;
const SESSION_STORAGE_KEY = "jb-analytics-session-id";

function generateSessionId(): string {
  return uuidv4();
}

export function getSessionId(): string | null {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      cachedSessionId = existing;
      return cachedSessionId;
    }

    const created = generateSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    cachedSessionId = created;
    return cachedSessionId;
  } catch (error) {
    console.warn("Unable to access sessionStorage for analytics session", error);
    cachedSessionId = generateSessionId();
    return cachedSessionId;
  }
}

export function resetSessionId() {
  cachedSessionId = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

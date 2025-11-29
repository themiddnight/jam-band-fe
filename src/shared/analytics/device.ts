import type { DeviceInfo } from "./types";

const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const tabletRegex = /iPad|Tablet|Nexus 7|Nexus 10|KFAPWI/i;

function detectCategory(userAgent: string): DeviceInfo["category"] {
  if (tabletRegex.test(userAgent)) {
    return "tablet";
  }
  if (mobileRegex.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
}

function detectBrowser(userAgent: string): string | undefined {
  if (/chrome|crios|crmo/i.test(userAgent) && !/edge|edgios|edga|opr/i.test(userAgent)) {
    return "Chrome";
  }
  if (/safari/i.test(userAgent) && !/chrome|crios|crmo|edge|edgios|edga/i.test(userAgent)) {
    return "Safari";
  }
  if (/firefox|fxios/i.test(userAgent)) {
    return "Firefox";
  }
  if (/edg|edge|edgios|edga/i.test(userAgent)) {
    return "Edge";
  }
  if (/opr|opera/i.test(userAgent)) {
    return "Opera";
  }
  return undefined;
}

function detectOS(userAgent: string): string | undefined {
  if (/windows nt 10/i.test(userAgent)) return "Windows 10";
  if (/windows nt 11/i.test(userAgent)) return "Windows 11";
  if (/mac os x/i.test(userAgent)) return "macOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return undefined;
}

let cachedDeviceInfo: DeviceInfo | null = null;

export function getDeviceInfo(): DeviceInfo | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  if (!cachedDeviceInfo) {
    const userAgent = navigator.userAgent;
    cachedDeviceInfo = {
      os: detectOS(userAgent),
      browser: detectBrowser(userAgent),
      category: detectCategory(userAgent),
    };
  }

  return cachedDeviceInfo;
}

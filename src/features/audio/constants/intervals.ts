// Common interval and throttle values used by audio hooks
export const PING_MEASURE_INTERVAL_MS = 2000; // default ping measure interval
export const PING_UI_THROTTLE_MS = 500; // throttle UI updates for ping

export const RTC_MEASURE_INTERVAL_MS = 2000; // default RTC measure interval
export const RTC_UI_THROTTLE_MS = 500; // throttle UI updates for RTC latency

// Additional timeouts used elsewhere (exported for consistency)
export const RTC_PENDING_CANDIDATE_RETRY_MS = 500;

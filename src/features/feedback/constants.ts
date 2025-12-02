export const FEEDBACK_PROMPT_STORAGE_KEY = "collab-feedback-state-v1";

// const isProduction = import.meta.env.RAILWAY_ENVIRONMENT_NAME === 'production';

// export const FEEDBACK_PROMPT_DELAY_MS = isProduction ? 5 * 60 * 1000 : 1000; // prod: 5 นาที, dev: 1 วินาที
// export const FEEDBACK_REMIND_DELAY_MS = isProduction ? 12 * 60 * 60 * 1000 : 5000; // prod: 12 ชั่วโมง, dev: 5 วินาที

export const FEEDBACK_PROMPT_DELAY_SEC = Number(import.meta.env.VITE_FEEDBACK_PROMPT_DELAY_SEC); // 5 minutes = 300 seconds
export const FEEDBACK_REMIND_DELAY_SEC = Number(import.meta.env.VITE_FEEDBACK_REMIND_DELAY_SEC); // 12 hours = 43,200 seconds

export const FEEDBACK_PROMPT_STORAGE_KEY = "collab-feedback-state-v1";

const isDev = import.meta.env.DEV;

export const FEEDBACK_PROMPT_DELAY_MS = isDev ? 1000 : 5 * 60 * 1000; // dev: 1 วินาที, prod: 5 นาที
export const FEEDBACK_REMIND_DELAY_MS = isDev ? 5000 : 24 * 60 * 60 * 1000; // dev: 5 วินาที, prod: 24 ชั่วโมง

import { useCallback, useMemo, useState } from "react";
import {
  FEEDBACK_PROMPT_DELAY_MS,
  FEEDBACK_PROMPT_STORAGE_KEY,
} from "../constants";
import type { FeedbackStorageState } from "../types";

const createInitialState = (): FeedbackStorageState => ({
  hasSeenInitialPrompt: false,
  nextPromptAt: Date.now() + FEEDBACK_PROMPT_DELAY_MS,
  skipToastActive: false,
  skipToastDismissed: false,
});

const readStateFromStorage = (): FeedbackStorageState => {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const raw = window.localStorage.getItem(FEEDBACK_PROMPT_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      window.localStorage.setItem(
        FEEDBACK_PROMPT_STORAGE_KEY,
        JSON.stringify(initial),
      );
      return initial;
    }

    const parsed = JSON.parse(raw) as FeedbackStorageState;
    
    // ถ้าเคย skip หรือ submit แล้ว ไม่ต้องตั้ง nextPromptAt ใหม่
    const shouldSkipPrompt = parsed.skipToastDismissed || parsed.submittedAt;
    
    return {
      ...createInitialState(),
      ...parsed,
      nextPromptAt: shouldSkipPrompt
        ? undefined
        : (parsed.nextPromptAt ?? Date.now() + FEEDBACK_PROMPT_DELAY_MS),
    };
  } catch (error) {
    console.warn("ไม่สามารถอ่านสถานะฟีดแบคจาก localStorage", error);
    return createInitialState();
  }
};

const persistState = (state: FeedbackStorageState) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      FEEDBACK_PROMPT_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.warn("ไม่สามารถบันทึกสถานะฟีดแบคลง localStorage", error);
  }
};

export const useFeedbackPromptState = () => {
  const [state, setState] = useState<FeedbackStorageState>(() => readStateFromStorage());

  const updateState = useCallback(
    (updater: (prev: FeedbackStorageState) => FeedbackStorageState) => {
      setState((prev) => {
        const next = updater(prev);
        persistState(next);
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      state,
      updateState,
    }),
    [state, updateState],
  );

  return value;
};

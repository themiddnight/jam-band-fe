import { useCallback, useMemo, useState, useEffect } from "react";
import {
  FEEDBACK_PROMPT_DELAY_MS,
  FEEDBACK_PROMPT_STORAGE_KEY,
} from "../constants";
import type { FeedbackStorageState } from "../types";
import { useUserStore } from "@/shared/stores/userStore";
import { getFeedbackState } from "@/shared/api/auth";

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
  const { isAuthenticated } = useUserStore();
  const [state, setState] = useState<FeedbackStorageState>(() => readStateFromStorage());
  const [isLoading, setIsLoading] = useState(false);

  // Load feedback state from user database if authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // For guest users, use localStorage state
      return;
    }

    const loadFeedbackState = async () => {
      try {
        setIsLoading(true);
        const feedbackState = await getFeedbackState();
        
        // Convert database timestamps to state
        const newState: FeedbackStorageState = {
          hasSeenInitialPrompt: false,
          skipToastActive: false,
          skipToastDismissed: false,
        };

        if (feedbackState.feedbackSubmittedAt) {
          newState.submittedAt = new Date(feedbackState.feedbackSubmittedAt).getTime();
          newState.nextPromptAt = undefined;
        } else if (feedbackState.feedbackDismissedAt) {
          newState.skipToastDismissed = true;
          newState.nextPromptAt = undefined;
        } else {
          // User hasn't submitted or dismissed, show prompt normally
          newState.nextPromptAt = Date.now() + FEEDBACK_PROMPT_DELAY_MS;
        }

        setState(newState);
      } catch (error) {
        console.warn("ไม่สามารถโหลดสถานะฟีดแบคจาก server", error);
        // Fallback to localStorage state
      } finally {
        setIsLoading(false);
      }
    };

    void loadFeedbackState();
  }, [isAuthenticated]);

  const updateState = useCallback(
    (updater: (prev: FeedbackStorageState) => FeedbackStorageState) => {
      setState((prev) => {
        const next = updater(prev);
        // Only persist to localStorage if not authenticated
        if (!isAuthenticated) {
          persistState(next);
        }
        return next;
      });
    },
    [isAuthenticated],
  );

  const value = useMemo(
    () => ({
      state,
      updateState,
      isLoading,
    }),
    [state, updateState, isLoading],
  );

  return value;
};

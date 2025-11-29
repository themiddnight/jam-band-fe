import { createContext, useContext } from "react";

export interface FeedbackPromptContextValue {
  openFeedbackModal: () => void;
}

export const FeedbackPromptContext = createContext<FeedbackPromptContextValue | null>(null);

export const useFeedbackPrompt = () => {
  const ctx = useContext(FeedbackPromptContext);
  if (!ctx) {
    throw new Error("useFeedbackPrompt ต้องถูกใช้ภายใน FeedbackPromptProvider เท่านั้น");
  }
  return ctx;
};

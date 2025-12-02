import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FeedbackFormModal } from "../components/FeedbackFormModal";
import { useFeedbackPromptState } from "../hooks/useFeedbackPromptState";
import { FEEDBACK_REMIND_DELAY_SEC } from "../constants";
import { FeedbackPromptContext } from "./FeedbackPromptContext";
import { useUserStore } from "@/shared/stores/userStore";
import { updateFeedbackState } from "@/shared/api/auth";

export const FeedbackPromptProvider = ({ children }: { children: ReactNode }) => {
  const { state, updateState } = useFeedbackPromptState();
  const { isAuthenticated } = useUserStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [resumePromptOnClose, setResumePromptOnClose] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (state.submittedAt || state.skipToastActive) {
      setShouldShowPrompt(false);
      return;
    }

    if (typeof state.nextPromptAt !== "number") {
      setShouldShowPrompt(false);
      return;
    }

    const now = Date.now();
    if (now >= state.nextPromptAt) {
      setShouldShowPrompt(true);
      if (!state.hasSeenInitialPrompt || state.snoozedUntil) {
        updateState((prev) => ({
          ...prev,
          hasSeenInitialPrompt: true,
          snoozedUntil: undefined,
        }));
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldShowPrompt(true);
      if (!state.hasSeenInitialPrompt || state.snoozedUntil) {
        updateState((prev) => ({
          ...prev,
          hasSeenInitialPrompt: true,
          snoozedUntil: undefined,
        }));
      }
    }, state.nextPromptAt - now);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    state.nextPromptAt,
    state.submittedAt,
    state.skipToastActive,
    state.hasSeenInitialPrompt,
    state.snoozedUntil,
    updateState,
  ]);

  const handleSubmitSuccess = useCallback(async () => {
    setIsModalOpen(false);
    setShouldShowPrompt(false);
    setResumePromptOnClose(false);
    
    const now = Date.now();
    updateState((prev) => ({
      ...prev,
      submittedAt: now,
      nextPromptAt: undefined,
      skipToastActive: false,
      skipToastDismissed: true,
    }));

    // Update user database if authenticated
    if (isAuthenticated) {
      try {
        await updateFeedbackState("submitted");
      } catch (error) {
        console.warn("ไม่สามารถอัพเดทสถานะฟีดแบคใน server", error);
      }
    }
  }, [updateState, isAuthenticated]);

  const handleOpenModal = useCallback(
    (options?: { fromPrompt?: boolean }) => {
      if (options?.fromPrompt) {
        setResumePromptOnClose(true);
        setShouldShowPrompt(false);
      }
      setIsModalOpen(true);
    },
    [],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    if (resumePromptOnClose && !state.submittedAt && !state.skipToastActive) {
      setShouldShowPrompt(true);
    }
    setResumePromptOnClose(false);
  }, [resumePromptOnClose, state.skipToastActive, state.submittedAt]);

  const handleRemindLater = useCallback(() => {
    const nextTime = Date.now() + FEEDBACK_REMIND_DELAY_SEC * 1000;
    setShouldShowPrompt(false);
    setResumePromptOnClose(false);
    updateState((prev) => ({
      ...prev,
      snoozedUntil: nextTime,
      nextPromptAt: nextTime,
    }));
  }, [updateState]);

  const handleSkip = useCallback(async () => {
    setShouldShowPrompt(false);
    setResumePromptOnClose(false);
    updateState((prev) => ({
      ...prev,
      nextPromptAt: undefined,
      skipToastActive: true,
      skipToastDismissed: false,
    }));

    // Update user database if authenticated
    if (isAuthenticated) {
      try {
        await updateFeedbackState("dismissed");
      } catch (error) {
        console.warn("ไม่สามารถอัพเดทสถานะฟีดแบคใน server", error);
      }
    }
  }, [updateState, isAuthenticated]);

  const handleDismissSkipToast = useCallback(async () => {
    updateState((prev) => ({
      ...prev,
      skipToastActive: false,
      skipToastDismissed: true,
    }));

    // Update user database if authenticated
    if (isAuthenticated) {
      try {
        await updateFeedbackState("dismissed");
      } catch (error) {
        console.warn("ไม่สามารถอัพเดทสถานะฟีดแบคใน server", error);
      }
    }
  }, [updateState, isAuthenticated]);

  const openFeedbackModal = useCallback(() => {
    handleOpenModal();
  }, [handleOpenModal]);

  const contextValue = useMemo(() => ({ openFeedbackModal }), [openFeedbackModal]);

  const shouldShowSkipToast = Boolean(state.skipToastActive && !state.skipToastDismissed);

  return (
    <FeedbackPromptContext.Provider value={contextValue}>
      {children}

      {shouldShowPrompt && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-info shadow max-w-2xs sm:max-w-xs gap-0!">
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-bold mb-1">🌟 Collab ขอฟีดแบคสั้นๆ เพื่อพัฒนาแอปฯ</p>
                <p className="text-xs font-light ml-4">
                  ใช้เวลาเพียง 1 นาที กรอกแบบสอบถามง่ายๆ เพื่อให้เราสร้างเครื่องมือทำเพลงที่ดีขึ้นสำหรับคุณ
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal({ fromPrompt: true })}>
                  กรอกเลย
                </button>
                <button className="btn btn-sm btn-outline" onClick={handleRemindLater}>
                  ไว้เตือนอีกครั้ง
                </button>
                <button className="btn btn-sm btn-ghost" onClick={handleSkip}>
                  ขอทำเองทีหลัง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shouldShowSkipToast && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success shadow max-w-2xs sm:max-w-xs gap-0!">
            <div>
              <p className="font-bold mb-1">✔︎ รับทราบ!</p>
              <p className="text-xs ml-4">
                คุณสามารถให้ Feedback ได้ทุกเมื่อที่ปุ่ม <b className="font-bold">Give us feedback</b> ที่ด้านล่างของหน้าจอ (Footer)
              </p>
            </div>
            <button className="btn btn-sm btn-outline ml-2" onClick={handleDismissSkipToast}>
              ปิด
            </button>
          </div>
        </div>
      )}

      <FeedbackFormModal
        open={isModalOpen}
        onClose={handleModalClose}
        onSubmitted={handleSubmitSuccess}
        onSkip={() => {
          handleSkip();
          handleModalClose();
        }}
      />
    </FeedbackPromptContext.Provider>
  );
};

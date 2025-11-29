import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../ui";
import { submitFeedback } from "../services/feedbackApi";
import type {
  FeedbackFavoriteRoom,
  FeedbackFormData,
  FeedbackRoleOption,
  FeedbackSkillLevel,
  SubmitFeedbackPayload,
} from "../types";
import { useUserStore } from "../../../shared";
import type { UserState } from "../../../shared/stores/userStore";
import { getSessionId } from "../../../shared/analytics/session";

interface FeedbackFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onSkip: () => void;
}

const DEFAULT_FORM: FeedbackFormData = {
  satisfactionScore: null,
  roles: [],
  otherRoleNote: "",
  skillLevel: null,
  favoriteRoom: null,
  latencyTolerance: null,
  returnLikelihood: null,
  comments: "",
};

const roleOptions: { value: FeedbackRoleOption; label: string }[] = [
  { value: "musician", label: "นักดนตรี" },
  { value: "songwriter", label: "นักแต่ง/เขียนเพลง" },
  { value: "producer", label: "โปรดิวเซอร์" },
  { value: "teacher_or_student", label: "ครูสอนดนตรี/นักเรียน" },
  { value: "hobbyist", label: "ทำเพลงเป็นงานอดิเรก" },
  { value: "other", label: "อื่นๆ (โปรดระบุ)" },
];

const skillOptions: { value: FeedbackSkillLevel; label: string }[] = [
  { value: "beginner", label: "มือใหม่" },
  { value: "intermediate", label: "ระดับกลาง" },
  { value: "professional", label: "มืออาชีพ/มีประสบการณ์" },
];

const roomOptions: { value: FeedbackFavoriteRoom; label: string }[] = [
  { value: "perform", label: "Perform Room" },
  { value: "arrange", label: "Arrange Room" },
];

const scoreChoices = [1, 2, 3, 4, 5];

export const FeedbackFormModal = ({ open, onClose, onSubmitted, onSkip }: FeedbackFormModalProps) => {
  const [formData, setFormData] = useState<FeedbackFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ensureUserId = useUserStore((state: UserState) => state.ensureUserId);

  useEffect(() => {
    if (!open) {
      setFormData(DEFAULT_FORM);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const isOtherRoleSelected = useMemo(
    () => formData.roles.includes("other"),
    [formData.roles],
  );

  const handleRoleToggle = (value: FeedbackRoleOption) => {
    setFormData((prev) => {
      const exists = prev.roles.includes(value);
      const nextRoles = exists
        ? prev.roles.filter((role) => role !== value)
        : [...prev.roles, value];
      return {
        ...prev,
        roles: nextRoles,
      };
    });
  };

  const handleSelect = <K extends keyof FeedbackFormData>(field: K, value: FeedbackFormData[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validate = (): string | null => {
    if (!formData.satisfactionScore) return "กรุณาให้คะแนนความพอใจ";
    if (!formData.roles.length) return "กรุณาเลือกบทบาทอย่างน้อย 1 ตัวเลือก";
    if (isOtherRoleSelected && !formData.otherRoleNote.trim()) {
      return "โปรดระบุบทบาทเพิ่มเติม";
    }
    if (!formData.skillLevel) return "กรุณาเลือกระดับทักษะ";
    if (!formData.favoriteRoom) return "กรุณาเลือกห้องที่ใช้งานบ่อย";
    if (!formData.latencyTolerance) return "กรุณาให้คะแนนความหน่วงที่ยอมรับได้";
    if (!formData.returnLikelihood) return "กรุณาให้คะแนนความเป็นไปได้ที่จะกลับมาใช้อีก";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const userId = ensureUserId();
      const sessionId = getSessionId();
      const payload: SubmitFeedbackPayload = {
        userId,
        sessionId,
        satisfactionScore: formData.satisfactionScore!,
        roles: formData.roles,
        otherRoleNote: formData.otherRoleNote.trim() || null,
        skillLevel: formData.skillLevel!,
        favoriteRoom: formData.favoriteRoom!,
        latencyTolerance: formData.latencyTolerance!,
        returnLikelihood: formData.returnLikelihood!,
        comments: formData.comments.trim() || undefined,
      };

      await submitFeedback(payload);
      onSubmitted();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("ไม่สามารถส่งฟอร์มได้ กรุณาลองใหม่");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipClick = () => {
    onSkip();
  };

  return (
    <Modal
      open={open}
      setOpen={(visible: boolean) => {
        if (!visible) {
          onClose();
        }
      }}
      title="แบบฟอร์ม Feedback"
      showOkButton={false}
      showCancelButton={false}
      size="3xl"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <h4 className="font-bold ">ความพอใจโดยรวม</h4>
          <p className="text-sm text-base-content/70">1 = ไม่พอใจ, 5 = พอใจมาก</p>
          <div className="rating">
            <input type="radio" name="satisfaction" className="rating-hidden" checked={formData.satisfactionScore === null} readOnly />
            {scoreChoices.map((score) => (
              <input
                key={score}
                type="radio"
                name="satisfaction"
                className="mask mask-star-2 bg-warning"
                checked={formData.satisfactionScore === score}
                onChange={() => handleSelect("satisfactionScore", score)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold ">บทบาทของคุณ (เลือกหลายข้อได้)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roleOptions.map((option) => (
              <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary mt-1"
                  checked={formData.roles.includes(option.value)}
                  onChange={() => handleRoleToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {isOtherRoleSelected && (
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="โปรดระบุบทบาทของคุณ"
              value={formData.otherRoleNote}
              onChange={(event) => handleSelect("otherRoleNote", event.target.value)}
            />
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-bold ">ระดับทักษะ</h4>
          <div className="flex flex-col gap-2">
            {skillOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="skillLevel"
                  className="radio radio-sm radio-primary"
                  checked={formData.skillLevel === option.value}
                  onChange={() => handleSelect("skillLevel", option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold ">ห้องที่ชอบ/ใช้บ่อยที่สุด</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roomOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="favoriteRoom"
                  className="radio radio-sm radio-primary"
                  checked={formData.favoriteRoom === option.value}
                  onChange={() => handleSelect("favoriteRoom", option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-bold ">ความหน่วง (Latency) ที่รู้สึกได้ ยอมรับได้แค่ไหน</h4>
            <p className="text-sm text-base-content/70">1 = รับไม่ได้, 5 = รับได้สบาย</p>
            <div className="rating">
              <input type="radio" name="latency" className="rating-hidden" checked={formData.latencyTolerance === null} readOnly />
              {scoreChoices.map((score) => (
                <input
                  key={`latency-${score}`}
                  type="radio"
                  name="latency"
                  className="mask mask-star-2 bg-warning"
                  checked={formData.latencyTolerance === score}
                  onChange={() => handleSelect("latencyTolerance", score)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold ">มีโอกาสกลับมาใช้งานอีกมากน้อยแค่ไหน</h4>
            <p className="text-sm text-base-content/70">1 = ไม่น่าจะกลับมา, 5 = กลับมาแน่นอน</p>
            <div className="rating">
              <input type="radio" name="returnLikelihood" className="rating-hidden" checked={formData.returnLikelihood === null} readOnly />
              {scoreChoices.map((score) => (
                <input
                  key={`return-${score}`}
                  type="radio"
                  name="returnLikelihood"
                  className="mask mask-star-2 bg-warning"
                  checked={formData.returnLikelihood === score}
                  onChange={() => handleSelect("returnLikelihood", score)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold ">ความคิดเห็นเพิ่มเติม (ถ้ามี)</h4>
          <textarea
            className="textarea textarea-bordered w-full min-h-28"
            placeholder="มีข้อเสนอแนะหรืออยากให้ปรับปรุงอะไร บอกเราได้เลย"
            value={formData.comments}
            onChange={(event) => handleSelect("comments", event.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button type="button" className="btn btn-outline" onClick={handleSkipClick}>
            ข้ามไปก่อน
          </button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? "loading" : ""}`} disabled={isSubmitting}>
            {isSubmitting ? "กำลังส่ง..." : "ส่ง Feedback"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

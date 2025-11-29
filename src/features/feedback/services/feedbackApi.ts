import type { SubmitFeedbackPayload } from "../types";

const FEEDBACK_API_URL = import.meta.env.VITE_FEEDBACK_API_URL as
  | string
  | undefined;

export async function submitFeedback(payload: SubmitFeedbackPayload) {
  if (!FEEDBACK_API_URL) {
    throw new Error("ยังไม่ได้ตั้งค่า VITE_FEEDBACK_API_URL ในไฟล์ .env");
  }

  const response = await fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      if (data?.message) {
        throw new Error(String(data.message));
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }
    throw new Error("ส่งแบบฟอร์มไม่สำเร็จ กรุณาลองอีกครั้ง");
  }
}

export type FeedbackRoleOption =
  | "musician"
  | "songwriter"
  | "producer"
  | "teacher_or_student"
  | "hobbyist"
  | "other";

export type FeedbackSkillLevel = "beginner" | "intermediate" | "professional";

export type FeedbackFavoriteRoom = "perform" | "arrange";

export interface FeedbackFormData {
  satisfactionScore: number | null;
  roles: FeedbackRoleOption[];
  otherRoleNote: string;
  skillLevel: FeedbackSkillLevel | null;
  favoriteRoom: FeedbackFavoriteRoom | null;
  latencyTolerance: number | null;
  returnLikelihood: number | null;
  comments: string;
}

export interface FeedbackStorageState {
  submittedAt?: number;
  dismissedAt?: number;
  snoozedUntil?: number;
  hasSeenInitialPrompt?: boolean;
  nextPromptAt?: number;
  skipToastDismissed?: boolean;
  skipToastActive?: boolean;
}

export interface SubmitFeedbackPayload {
  userId: string;
  isAuthenticated?: boolean;
  authenticatedUserId?: string | null;
  sessionId?: string | null;
  satisfactionScore: number;
  roles: FeedbackRoleOption[];
  otherRoleNote?: string | null;
  skillLevel: FeedbackSkillLevel;
  favoriteRoom: FeedbackFavoriteRoom;
  latencyTolerance: number;
  returnLikelihood: number;
  comments?: string;
}

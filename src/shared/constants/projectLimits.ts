import type { UserType } from "../stores/userStore";

/**
 * Project limits configuration per user type
 * This allows easy adjustment for premium features in the future
 */
export const PROJECT_LIMITS: Record<UserType, number> = {
  GUEST: 0, // Guests cannot save projects
  REGISTERED: 2, // Free tier: 2 projects
  PREMIUM: Infinity, // Premium: unlimited projects
};

/**
 * Get the project limit for a specific user type
 */
export function getProjectLimit(userType: UserType): number {
  return PROJECT_LIMITS[userType];
}

/**
 * Check if a user has reached their project limit
 */
export function isProjectLimitReached(
  currentProjectCount: number,
  userType: UserType
): boolean {
  const limit = getProjectLimit(userType);
  if (limit === Infinity) {
    return false; // Unlimited
  }
  return currentProjectCount >= limit;
}

/**
 * Get the default project limit message
 */
export function getProjectLimitMessage(userType: UserType): string {
  const limit = getProjectLimit(userType);
  if (limit === Infinity) {
    return "Unlimited projects";
  }
  if (limit === 0) {
    return "Guests cannot save projects";
  }
  return `You can save up to ${limit} project${limit > 1 ? "s" : ""}`;
}


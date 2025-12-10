import { useUserStore } from "../stores/userStore";

/**
 * Check if user is restricted (guest or unverified registered user)
 * Unverified registered users should have the same restrictions as guest users
 */
export function isUserRestricted(): boolean {
  const { isAuthenticated, userType, authUser } = useUserStore.getState();
  
  // Guest users are always restricted
  if (userType === "GUEST" || !isAuthenticated) {
    return true;
  }
  
  // Registered users who haven't verified their email are also restricted
  if (userType === "REGISTERED" && authUser && !authUser.emailVerified) {
    return true;
  }
  
  // Premium users and verified registered users are not restricted
  return false;
}

/**
 * Get restriction message for restricted users
 */
export function getRestrictionMessage(): string {
  const { isAuthenticated, userType, authUser } = useUserStore.getState();
  
  if (userType === "GUEST" || !isAuthenticated) {
    return "Guest users cannot access this feature. Please sign up to access this feature.";
  }
  
  if (userType === "REGISTERED" && authUser && !authUser.emailVerified) {
    return "Please verify your email to access this feature.";
  }
  
  return "This feature is not available.";
}


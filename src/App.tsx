import { routes, type AppRoute } from "./app-config";
import { useUserStore, PWAUpdatePrompt, ErrorBoundary } from "./shared";
import { useDeepLinkHandler } from "./shared/hooks/useDeepLinkHandler";
import { usePresetSync } from "./shared/hooks/usePresetSync";
import { useAuth } from "./shared/hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useLayoutEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { trackSessionStart } from "./shared/analytics/events";
import { FeedbackPromptProvider } from "./features/feedback/context/FeedbackPromptProvider";

const queryClient = new QueryClient();

export default function App() {
  const { isAuthenticated, userType } = useUserStore();
  const { checkAuth } = useAuth();

  // Initialize deep link handling
  useDeepLinkHandler();

  // Sync presets with API when authenticated
  usePresetSync();

  // Restore login state from token on app start
  useLayoutEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Clear guest state on app start if user is not authenticated
  // This ensures the auth choice modal always shows for non-authenticated users
  // But only if they haven't chosen in this session
  useLayoutEffect(() => {
    const sessionAuthChoice = sessionStorage.getItem("auth_choice_made");
    if (!isAuthenticated && userType === "GUEST" && !sessionAuthChoice) {
      // Clear guest state - will be set by modal when user chooses
      useUserStore.getState().clearUser();
    }
  }, [isAuthenticated, userType]);

  useEffect(() => {
    trackSessionStart();
    
    // Clear error recovery flag on successful app load
    sessionStorage.removeItem('error-recovery-attempted');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FeedbackPromptProvider>
          <Routes>
            {routes.map(({ path, component: Component }: AppRoute) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Routes>
          <PWAUpdatePrompt />
        </FeedbackPromptProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

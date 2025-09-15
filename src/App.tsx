import { routes, type AppRoute } from "./app-config";
import { useUserStore, PWAUpdatePrompt, ErrorBoundary } from "@/shared";
import { useDeepLinkHandler } from "./shared/hooks/useDeepLinkHandler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

export default function App() {
  const { ensureUserId } = useUserStore();

  // Initialize deep link handling
  useDeepLinkHandler();

  // Ensure userId exists on first app entry
  useLayoutEffect(() => {
    ensureUserId();
  }, [ensureUserId]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Routes>
          {routes.map(({ path, component: Component }: AppRoute) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Routes>
        <PWAUpdatePrompt />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

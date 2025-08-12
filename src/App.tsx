import { routes, type AppRoute } from "./app-config";
import { useUserStore, PWAUpdatePrompt } from "@/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

export default function App() {
  const { ensureUserId } = useUserStore();

  // Ensure userId exists on first app entry
  useLayoutEffect(() => {
    ensureUserId();
  }, [ensureUserId]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {routes.map(({ path, component: Component }: AppRoute) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Routes>
      <PWAUpdatePrompt />
    </QueryClientProvider>
  );
}

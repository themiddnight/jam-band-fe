import Lobby from "./pages/Lobby";
import Room from "./pages/Room";
import Invite from "./pages/Invite";
import { useUserStore } from "./stores/userStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";

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
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/invite/:roomId" element={<Invite />} />
        <Route path="*" element={<Lobby />} />
      </Routes>
      <PWAUpdatePrompt />
    </QueryClientProvider>
  );
}

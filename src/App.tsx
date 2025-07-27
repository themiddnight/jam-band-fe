import { Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import { useUserStore } from './stores/userStore';
import { useLayoutEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient()

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
      </Routes>
    </QueryClientProvider>
  );
}

import { usePWA } from "../hooks/usePWA";

export function PWAUpdatePrompt() {
  const { offlineReady, needRefresh, updateApp } = usePWA();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {offlineReady && (
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>App ready to work offline</span>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <span>🔄</span>
            <span>New content available</span>
            <button
              onClick={updateApp}
              className="ml-2 px-3 py-1 bg-white text-blue-500 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

declare global {
  interface WindowEventMap {
    'vite-plugin-pwa:update-found': CustomEvent<{
      needRefresh: boolean
      offlineReady: boolean
      update: () => void
    }>
    'vite-plugin-pwa:offline-ready': Event
    'vite-plugin-pwa:need-refresh': Event
  }
}

export {} 
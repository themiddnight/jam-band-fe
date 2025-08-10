import { useEffect, useState } from 'react'

interface PWAUpdate {
  needRefresh: boolean
  offlineReady: boolean
  update: () => void
}

export function usePWA() {
  const [update, setUpdate] = useState<PWAUpdate | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    // Listen for PWA updates
    const handleUpdate = (e: CustomEvent) => {
      setUpdate(e.detail)
      setOfflineReady(e.detail.offlineReady)
      setNeedRefresh(e.detail.needRefresh)
    }

    // Listen for offline ready
    const handleOfflineReady = () => {
      setOfflineReady(true)
    }

    // Listen for need refresh
    const handleNeedRefresh = () => {
      setNeedRefresh(true)
    }

    window.addEventListener('vite-plugin-pwa:update-found', handleUpdate as EventListener)
    window.addEventListener('vite-plugin-pwa:offline-ready', handleOfflineReady)
    window.addEventListener('vite-plugin-pwa:need-refresh', handleNeedRefresh)

    return () => {
      window.removeEventListener('vite-plugin-pwa:update-found', handleUpdate as EventListener)
      window.removeEventListener('vite-plugin-pwa:offline-ready', handleOfflineReady)
      window.removeEventListener('vite-plugin-pwa:need-refresh', handleNeedRefresh)
    }
  }, [])

  const updateApp = () => {
    if (update) {
      update.update()
      setNeedRefresh(false)
    }
  }

  return {
    offlineReady,
    needRefresh,
    updateApp
  }
} 
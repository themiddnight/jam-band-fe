import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle protocol handler registration
    const registerProtocolHandler = () => {
      if ('registerProtocolHandler' in navigator) {
        try {
          // Modern browsers only accept 2 parameters
          navigator.registerProtocolHandler(
            'web+collab',
            `${window.location.origin}/invite/%s`
          );
        } catch (error) {
          console.error('Failed to register protocol handler', error);
        }
      }
    };

    // Handle incoming protocol URLs
    const handleProtocolUrl = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'PROTOCOL_HANDLER_URL') {
        const url = event.data.url;
        if (url?.startsWith('web+collab:')) {
          // Extract room ID from protocol URL
          const roomId = url.replace('web+collab:', '');
          if (roomId) {
            navigate(`/invite/${roomId}`);
          }
        }
      }
    };

    // Handle app launch from URL
    const handleAppLaunch = () => {
      // Check if app was launched from a URL
      if ('launchQueue' in window) {
        (window as any).launchQueue.setConsumer((launchParams: any) => {
          if (launchParams.targetURL) {
            const url = new URL(launchParams.targetURL);
            // Handle invitation URLs
            if (url.pathname.startsWith('/invite/')) {
              navigate(url.pathname + url.search);
            }
          }
        });
      }
    };

    // Handle share target (if implemented in the future)
    const handleShareTarget = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('share-target')) {
        // Handle shared content if needed
        const sharedData = urlParams.get('share-target');
        console.info('Share target detected', sharedData);
      }
    };

    // Initialize handlers
    registerProtocolHandler();
    handleAppLaunch();
    handleShareTarget();

    // Add event listeners
    window.addEventListener('message', handleProtocolUrl);

    // Cleanup
    return () => {
      window.removeEventListener('message', handleProtocolUrl);
    };
  }, [navigate]);

  // Utility function to generate invitation URLs
  const generateInviteUrl = (roomId: string, role: 'band_member' | 'audience', roomType?: 'perform' | 'produce') => {
    const baseUrl = `${window.location.origin}/invite/${roomId}?role=${role}`;
    return roomType ? `${baseUrl}&roomType=${roomType}` : baseUrl;
  };

  // Utility function to generate protocol URL
  const generateProtocolUrl = (roomId: string) => {
    return `web+collab:${roomId}`;
  };

  return {
    generateInviteUrl,
    generateProtocolUrl,
  };
}; 
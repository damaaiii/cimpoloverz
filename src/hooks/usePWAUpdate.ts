import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Periodically check quietly for new deployments while online without deleting local data
        const checkInterval = window.setInterval(() => {
          if (navigator.onLine) {
            void registration.update();
          }
        }, 60 * 60 * 1000);
        return () => window.clearInterval(checkInterval);
      },
    });
    updateFnRef.current = updateSW;
  }, []);

  const updateNow = useCallback(async () => {
    if (!updateFnRef.current || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateFnRef.current(true);
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return {
    needRefresh,
    isUpdating,
    updateNow,
    dismissUpdate,
  };
}

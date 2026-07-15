import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity. `navigator.onLine` is a fast heuristic (it can
 * report online while the network is unusable), so components combine it with
 * Firestore snapshot metadata (`fromCache` / `hasPendingWrites`) for the
 * authoritative sync state.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

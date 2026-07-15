import { useEffect, useRef, useState } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import { CloudOff, CloudUpload, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { db } from '../lib/firebase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Global connectivity/sync banner. While offline it reassures the user that
 * work continues locally; when connectivity returns it reports "syncing" until
 * Firestore has flushed every queued write, then confirms briefly.
 */
export function SyncStatusIndicator() {
  const online = useOnlineStatus();
  const [phase, setPhase] = useState<'hidden' | 'offline' | 'syncing' | 'synced'>(
    online ? 'hidden' : 'offline'
  );
  const wasOffline = useRef(!online);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (!online) {
      wasOffline.current = true;
      setPhase('offline');
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setPhase('syncing');
      // Resolves when every write queued at this moment has been
      // acknowledged by the server — i.e. offline work has fully synced.
      waitForPendingWrites(db)
        .catch(() => {})
        .then(() => {
          if (cancelled) return;
          setPhase('synced');
          hideTimer = setTimeout(() => !cancelled && setPhase('hidden'), 4000);
        });
    }

    return () => {
      cancelled = true;
      clearTimeout(hideTimer);
    };
  }, [online]);

  return (
    <AnimatePresence>
      {phase !== 'hidden' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          aria-live="polite"
          className={
            phase === 'offline'
              ? 'bg-amber-500 text-white'
              : phase === 'syncing'
                ? 'bg-sky-600 text-white'
                : 'bg-emerald-600 text-white'
          }
        >
          <div className="container mx-auto max-w-7xl px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-center">
            {phase === 'offline' && (
              <>
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
                <span>Offline — your work is saved on this device and will sync automatically</span>
              </>
            )}
            {phase === 'syncing' && (
              <>
                <CloudUpload className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>Back online — synchronizing local changes…</span>
              </>
            )}
            {phase === 'synced' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>All changes synchronized</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

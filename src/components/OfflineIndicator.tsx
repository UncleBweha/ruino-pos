import { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, CloudUpload, Loader2, CheckCircle2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, syncAll, syncMeta } = useOfflineSync();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevOnlineRef = useRef(isOnline);

  const isSynced = isOnline && pendingCount === 0 && !syncing;
  const hasPending = pendingCount > 0;

  // Show indicator on status change, auto-hide after 5s if no pending work
  useEffect(() => {
    const statusChanged = prevOnlineRef.current !== isOnline;
    prevOnlineRef.current = isOnline;

    // Show on any meaningful state
    if (!isOnline || syncing || hasPending || (isSynced && statusChanged)) {
      setVisible(true);
      setFading(false);
      clearTimeout(timerRef.current);
    }

    // Auto-hide after 5s when synced or just came online with nothing pending
    if (isSynced || (isOnline && !hasPending && !syncing)) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFading(true);
        // Remove from DOM after fade animation
        setTimeout(() => setVisible(false), 500);
      }, 5000);
    }

    return () => clearTimeout(timerRef.current);
  }, [isOnline, syncing, hasPending, isSynced]);

  // Keep visible while offline or has pending items
  useEffect(() => {
    if (!isOnline || hasPending || syncing) {
      setFading(false);
      setVisible(true);
      clearTimeout(timerRef.current);
    }
  }, [isOnline, hasPending, syncing]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-500',
        !isOnline && 'bg-destructive text-destructive-foreground',
        isOnline && syncing && 'bg-warning/90 text-warning-foreground',
        isOnline && hasPending && !syncing && 'bg-warning/90 text-warning-foreground',
        isSynced && 'bg-primary text-primary-foreground',
        fading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
      )}
    >
      {!isOnline && <WifiOff className="w-4 h-4" />}
      {isOnline && syncing && <Loader2 className="w-4 h-4 animate-spin" />}
      {isOnline && hasPending && !syncing && <CloudUpload className="w-4 h-4" />}
      {isSynced && <CheckCircle2 className="w-4 h-4" />}

      <span>
        {!isOnline && 'Offline mode — changes saved locally'}
        {isOnline && syncing && `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}…`}
        {isOnline && hasPending && !syncing && `${pendingCount} item${pendingCount !== 1 ? 's' : ''} pending sync`}
        {isSynced && 'All changes synced ✓'}
      </span>

      <span
        className={cn(
          'w-2.5 h-2.5 rounded-full ml-1 shrink-0 border border-background/30',
          isOnline ? 'bg-primary-foreground' : 'bg-destructive-foreground',
        )}
      />

      {hasPending && isOnline && !syncing && (
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs ml-1"
          onClick={syncAll}
        >
          <CloudUpload className="w-3 h-3 mr-1" />
          Sync Now
        </Button>
      )}
    </div>
  );
}

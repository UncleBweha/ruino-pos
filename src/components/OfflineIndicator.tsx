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
        'fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md text-xs font-medium transition-all duration-500',
        !isOnline && 'bg-destructive text-destructive-foreground',
        isOnline && syncing && 'bg-warning/90 text-warning-foreground',
        isOnline && hasPending && !syncing && 'bg-warning/90 text-warning-foreground',
        isSynced && 'bg-primary text-primary-foreground',
        fading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
      )}
    >
      {!isOnline && <WifiOff className="w-3 h-3" />}
      {isOnline && syncing && <Loader2 className="w-3 h-3 animate-spin" />}
      {isOnline && hasPending && !syncing && <CloudUpload className="w-3 h-3" />}
      {isSynced && <CheckCircle2 className="w-3 h-3" />}

      <span>
        {!isOnline && 'Offline'}
        {isOnline && syncing && `Syncing ${pendingCount}…`}
        {isOnline && hasPending && !syncing && `${pendingCount} pending`}
        {isSynced && 'Synced ✓'}
      </span>

      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0 border border-background/30',
          isOnline ? 'bg-primary-foreground' : 'bg-destructive-foreground',
        )}
      />

      {hasPending && isOnline && !syncing && (
        <Button
          variant="secondary"
          size="sm"
          className="h-5 text-[10px] px-2 ml-0.5"
          onClick={syncAll}
        >
          Sync
        </Button>
      )}
    </div>
  );
}

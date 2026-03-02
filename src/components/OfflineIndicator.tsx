import { WifiOff, Wifi, CloudUpload, Loader2, CheckCircle2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, syncAll, syncMeta } = useOfflineSync();

  // Determine state
  const isSynced = isOnline && pendingCount === 0 && !syncing;
  const hasPending = pendingCount > 0;

  // Don't show anything if fully synced and never synced before
  if (isSynced && !syncMeta.lastSyncTime) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300',
        !isOnline && 'bg-destructive text-destructive-foreground',
        isOnline && syncing && 'bg-warning/90 text-warning-foreground',
        isOnline && hasPending && !syncing && 'bg-warning/90 text-warning-foreground',
        isSynced && 'bg-primary text-primary-foreground animate-in fade-in duration-300',
      )}
    >
      {/* Status icon */}
      {!isOnline && <WifiOff className="w-4 h-4" />}
      {isOnline && syncing && <Loader2 className="w-4 h-4 animate-spin" />}
      {isOnline && hasPending && !syncing && <CloudUpload className="w-4 h-4" />}
      {isSynced && <CheckCircle2 className="w-4 h-4" />}

      {/* Status text */}
      <span>
        {!isOnline && 'Offline mode — changes saved locally'}
        {isOnline && syncing && `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}…`}
        {isOnline && hasPending && !syncing && `${pendingCount} item${pendingCount !== 1 ? 's' : ''} pending sync`}
        {isSynced && 'All changes synced ✓'}
      </span>

      {/* Connection dot */}
      <span
        className={cn(
          'w-2.5 h-2.5 rounded-full ml-1 shrink-0 border border-background/30',
          isOnline ? 'bg-primary-foreground' : 'bg-destructive-foreground',
        )}
      />

      {/* Manual sync button */}
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

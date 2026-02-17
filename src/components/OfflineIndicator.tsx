import { WifiOff, Wifi, CloudUpload, Loader2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, syncAll } = useOfflineSync();

  // Don't show anything if online and nothing pending
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all',
        isOnline
          ? 'bg-warning/90 text-warning-foreground'
          : 'bg-destructive text-destructive-foreground'
      )}
    >
      {isOnline ? (
        <Wifi className="w-4 h-4" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}

      <span>
        {isOnline
          ? `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} pending sync`
          : 'Offline mode'}
      </span>

      {pendingCount > 0 && isOnline && (
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs ml-1"
          onClick={syncAll}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <CloudUpload className="w-3 h-3 mr-1" />
          )}
          Sync
        </Button>
      )}
    </div>
  );
}

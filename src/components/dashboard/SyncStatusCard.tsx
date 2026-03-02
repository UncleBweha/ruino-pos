import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { clearSyncErrors } from '@/lib/syncMeta';
import { CloudUpload, CheckCircle2, AlertTriangle, Clock, Wifi, WifiOff, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function SyncStatusCard() {
  const { isOnline, pendingCount, syncing, syncAll, syncMeta } = useOfflineSync();

  const handleClearErrors = () => {
    clearSyncErrors();
    // Force re-render by triggering a refresh
    window.location.reload();
  };

  return (
    <Card className="glass-card border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <CloudUpload className="w-5 h-5 text-primary" />
          Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection</span>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Pending Items */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pending Items</span>
          <div className="flex items-center gap-2">
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-warning" />
            ) : pendingCount === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
            <span className={cn(
              'text-sm font-medium',
              pendingCount > 0 ? 'text-warning' : 'text-emerald-600'
            )}>
              {syncing ? 'Syncing…' : pendingCount === 0 ? 'All synced' : `${pendingCount} pending`}
            </span>
          </div>
        </div>

        {/* Last Sync Time */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Synced</span>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              {syncMeta.lastSyncTime
                ? formatDistanceToNow(new Date(syncMeta.lastSyncTime), { addSuffix: true })
                : 'Never'}
            </span>
          </div>
        </div>

        {/* Total Synced */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Synced</span>
          <span className="text-sm font-medium">{syncMeta.totalSyncedAllTime} items</span>
        </div>

        {/* Sync Errors */}
        {syncMeta.syncErrors.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {syncMeta.syncErrors.length} Error{syncMeta.syncErrors.length > 1 ? 's' : ''}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleClearErrors}>
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {syncMeta.syncErrors.slice(0, 5).map((err) => (
                <div key={err.id} className="text-xs bg-destructive/10 rounded p-2">
                  <span className="font-medium">{err.type}:</span> {err.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Sync Button */}
        {pendingCount > 0 && isOnline && (
          <Button
            className="w-full"
            size="sm"
            onClick={syncAll}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CloudUpload className="w-4 h-4 mr-2" />
            )}
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

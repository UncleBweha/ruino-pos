import { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Install Prompt ──

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-primary text-primary-foreground max-w-sm w-[calc(100%-2rem)] animate-in slide-in-from-top duration-300">
      <Download className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install Ruinu POS</p>
        <p className="text-xs opacity-80">Add to home screen for instant access</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="h-8 text-xs shrink-0"
        onClick={handleInstall}
      >
        Install
      </Button>
      <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Update (auto-update mode — no prompt needed) ──

export function PWAUpdatePrompt() {
  useEffect(() => {
    registerSW({
      onRegistered(registration) {
        // Check for updates every 60 seconds
        if (registration) {
          setInterval(() => {
            registration.update();
          }, 60 * 1000);
        }
      },
      onOfflineReady() {
        // App is ready to work offline
      },
    });
  }, []);

  return null;
}

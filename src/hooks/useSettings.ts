import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ReceiptSettings } from '@/types/database';
import { cacheSettings, getCachedSettings } from '@/lib/offlineDb';

export function useSettings() {
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedSettings();
        if (cached) {
          setReceiptSettings(cached as ReceiptSettings);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial settings cache load error:', err);
      }

      // 2. Fetch fresh data in background
      await fetchReceiptSettings();
    }
    init();
  }, []);

  async function fetchReceiptSettings() {
    try {
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setReceiptSettings(data as ReceiptSettings);
        cacheSettings(data).catch(console.error);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch settings, checking cache...', err);
      try {
        const cached = await getCachedSettings();
        if (cached) {
          setReceiptSettings(cached as ReceiptSettings);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }

      if (!navigator.onLine) {
        setError('Working Offline - Using cached settings');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch settings');
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateReceiptSettings(updates: Partial<ReceiptSettings>): Promise<void> {
    if (!receiptSettings) throw new Error('No settings found');

    const { data, error } = await supabase
      .from('receipt_settings')
      .update(updates)
      .eq('id', receiptSettings.id)
      .select()
      .single();

    if (error) throw error;
    setReceiptSettings(data as ReceiptSettings);
  }

  return {
    receiptSettings,
    loading,
    error,
    updateReceiptSettings,
    refresh: fetchReceiptSettings,
  };
}

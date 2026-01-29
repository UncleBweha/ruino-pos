import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ReceiptSettings } from '@/types/database';

export function useSettings() {
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceiptSettings();
  }, []);

  async function fetchReceiptSettings() {
    try {
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setReceiptSettings(data as ReceiptSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
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

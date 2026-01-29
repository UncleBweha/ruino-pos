import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CashBox } from '@/types/database';

export function useCashBox() {
  const [transactions, setTransactions] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cash_box')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data as CashBox[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cash box');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();

    // Set up realtime subscription
    const channel = supabase
      .channel('cashbox-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_box' },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTransactions]);

  // Calculate daily totals
  function getDailyTotal(date: Date = new Date()): number {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return transactions
      .filter((t) => {
        const txDate = new Date(t.created_at);
        return txDate >= startOfDay && txDate <= endOfDay;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get transactions for a specific date
  function getTransactionsForDate(date: Date): CashBox[] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return transactions.filter((t) => {
      const txDate = new Date(t.created_at);
      return txDate >= startOfDay && txDate <= endOfDay;
    });
  }

  const todayTotal = getDailyTotal();
  const todayTransactions = getTransactionsForDate(new Date());

  return {
    transactions,
    todayTransactions,
    todayTotal,
    loading,
    error,
    getDailyTotal,
    getTransactionsForDate,
    refresh: fetchTransactions,
  };
}

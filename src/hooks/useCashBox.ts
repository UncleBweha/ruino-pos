import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CashBox } from '@/types/database';
import { cacheCashBox, getCachedCashBox } from '@/lib/offlineDb';

export function useCashBox() {
  const [transactions, setTransactions] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from('cash_box')
        .select('*')
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Get unique cashier IDs
      const cashierIds = [...new Set(txData.map((t) => t.cashier_id))];

      // Fetch profiles for those cashiers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', cashierIds);

      // Map profiles by user_id
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Attach cashier info to transactions
      const transactionsWithCashier = txData.map((tx) => ({
        ...tx,
        cashier: profileMap.get(tx.cashier_id) || null,
      }));

      setTransactions(transactionsWithCashier as CashBox[]);
      cacheCashBox(transactionsWithCashier).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch cash box, checking cache...', err);
      try {
        const cached = await getCachedCashBox();
        if (cached && cached.length > 0) {
          setTransactions(cached as CashBox[]);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch cash box');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedCashBox();
        if (cached && cached.length > 0) {
          setTransactions(cached as CashBox[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial cash box cache load error:', err);
      }
      // 2. Refresh in background
      await fetchTransactions();
    }

    init();

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

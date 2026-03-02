import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Credit } from '@/types/database';
import { cacheCredits, getCachedCredits, queueOp } from '@/lib/offlineDb';

export function useCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('*, sale:sales(*, sale_items(*))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredits(data as Credit[]);
      cacheCredits(data || []).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch credits, checking cache...', err);
      try {
        const cached = await getCachedCredits();
        if (cached && cached.length > 0) {
          setCredits(cached as Credit[]);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }

      if (!navigator.onLine) {
        setError('Working Offline');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch credits');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedCredits();
        if (cached && cached.length > 0) {
          setCredits(cached as Credit[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial credits cache load error:', err);
      }
      // 2. Refresh in background
      await fetchCredits();
    }

    init();

    // Set up realtime subscription
    const channel = supabase
      .channel('credits-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credits' },
        () => {
          fetchCredits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCredits]);

  async function markAsPaid(creditId: string, amountPaid?: number, paymentMethod: 'cash' | 'mpesa' | 'till' | 'cheque' = 'cash'): Promise<void> {
    if (!user) throw new Error('User not authenticated');

    if (!navigator.onLine) {
      // Offline: update local state and queue for sync
      const credit = credits.find(c => c.id === creditId);
      if (!credit) throw new Error('Credit not found');

      const paymentAmount = amountPaid || credit.balance;
      const newAmountPaid = credit.amount_paid + paymentAmount;
      const newBalance = credit.total_owed - newAmountPaid;
      const isPaid = newBalance <= 0;

      // Update local state
      setCredits(prev => prev.map(c => c.id === creditId ? {
        ...c,
        amount_paid: newAmountPaid,
        balance: Math.max(0, newBalance),
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null,
      } : c));

      // Update cache
      const updatedCredits = credits.map(c => c.id === creditId ? {
        ...c,
        amount_paid: newAmountPaid,
        balance: Math.max(0, newBalance),
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null,
      } : c);
      await cacheCredits(updatedCredits).catch(console.error);

      await queueOp({
        type: 'credit_payment',
        payload: {
          creditId,
          amountPaid: paymentAmount,
          paymentMethod,
          cashierId: user.id,
          saleId: credit.sale_id,
          customerName: credit.customer_name,
          isPaid,
        },
        createdAt: new Date().toISOString(),
        tempId: `cp-${Date.now()}`,
      });

      return;
    }

    // Fetch the latest credit data from DB to avoid stale state issues
    const { data: freshCredit, error: fetchError } = await supabase
      .from('credits')
      .select('*')
      .eq('id', creditId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!freshCredit) throw new Error('Credit not found');

    const paymentAmount = amountPaid || freshCredit.balance;
    const newAmountPaid = freshCredit.amount_paid + paymentAmount;
    const newBalance = freshCredit.total_owed - newAmountPaid;
    const isPaid = newBalance <= 0;

    const { error: updateError } = await supabase
      .from('credits')
      .update({
        amount_paid: newAmountPaid,
        balance: Math.max(0, newBalance),
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .eq('id', creditId);

    if (updateError) throw updateError;

    // Use freshCredit for subsequent operations
    const credit = freshCredit;

    // Log individual payment for revenue attribution
    await supabase.from('credit_payments').insert({
      credit_id: creditId,
      amount: paymentAmount,
      payment_method: paymentMethod,
      cashier_id: user.id,
    });

    // Update the associated sale status and payment method when fully paid
    if (isPaid) {
      await supabase
        .from('sales')
        .update({
          status: 'completed',
          payment_method: `credit_${paymentMethod}`
        })
        .eq('id', credit.sale_id);
    }

    // Add to cash box for all payment methods (money received)
    await supabase.from('cash_box').insert({
      sale_id: credit.sale_id,
      amount: paymentAmount,
      transaction_type: 'credit_payment',
      description: `Credit payment from ${credit.customer_name} via ${paymentMethod}`,
      cashier_id: user.id,
    });
  }

  async function markAsReturned(creditId: string): Promise<void> {
    if (!user) throw new Error('User not authenticated');

    const credit = credits.find((c) => c.id === creditId);
    if (!credit) throw new Error('Credit not found');

    // Update credit status
    const { error: updateError } = await supabase
      .from('credits')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
      })
      .eq('id', creditId);

    if (updateError) throw updateError;

    // Void the sale
    await supabase
      .from('sales')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
      })
      .eq('id', credit.sale_id);

    // Return items to inventory using secure function
    if (credit.sale?.sale_items) {
      for (const item of credit.sale.sale_items) {
        const { error: stockError } = await supabase.rpc('update_product_stock', {
          p_product_id: item.product_id,
          p_quantity_change: item.quantity, // Positive to restore
        });

        if (stockError) console.error('Stock restore error:', stockError);
      }
    }
  }

  /**
   * Partially return selected items from a credit.
   * - Returned items go back to inventory.
   * - Credit total_owed and balance are reduced by returned items' value.
   * - If remaining balance <= 0, the credit is fully resolved.
   */
  async function partialReturn(creditId: string, returnItems: { id: string; quantity: number }[]): Promise<void> {
    if (!user) throw new Error('User not authenticated');
    if (returnItems.length === 0) throw new Error('No items selected for return');

    // Fetch fresh credit
    const { data: freshCredit, error: fetchError } = await supabase
      .from('credits')
      .select('*, sale:sales(*, sale_items(*))')
      .eq('id', creditId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!freshCredit) throw new Error('Credit not found');

    const allItems = freshCredit.sale?.sale_items || [];

    // Check if this is effectively a full return
    const isFullReturn = returnItems.every((rt) => {
      const orig = allItems.find((i: any) => i.id === rt.id);
      return orig && rt.quantity >= orig.quantity;
    }) && returnItems.length === allItems.length;

    if (isFullReturn) {
      await markAsReturned(creditId);
      return;
    }

    let returnedTotal = 0;
    let returnedProfit = 0;

    // Process each return item
    for (const rt of returnItems) {
      const orig = allItems.find((i: any) => i.id === rt.id);
      if (!orig) continue;

      const qtyToReturn = Math.min(rt.quantity, orig.quantity);
      const itemReturnTotal = orig.unit_price * qtyToReturn;
      const itemReturnProfit = (orig.profit / orig.quantity) * qtyToReturn;
      returnedTotal += itemReturnTotal;
      returnedProfit += itemReturnProfit;

      // Restore stock
      if (orig.product_id) {
        const { error: stockError } = await supabase.rpc('update_product_stock', {
          p_product_id: orig.product_id,
          p_quantity_change: qtyToReturn,
        });
        if (stockError) console.error('Stock restore error:', stockError);
      }

      if (qtyToReturn >= orig.quantity) {
        // Fully returning this item — delete it
        await supabase.from('sale_items').delete().eq('id', orig.id);
      } else {
        // Partially returning — update quantity and totals
        const newQty = orig.quantity - qtyToReturn;
        const newTotal = orig.unit_price * newQty;
        const newProfit = (orig.profit / orig.quantity) * newQty;
        await supabase
          .from('sale_items')
          .update({
            quantity: newQty,
            total: newTotal,
            profit: newProfit,
          })
          .eq('id', orig.id);
      }
    }

    // Update credit amounts
    const newTotalOwed = freshCredit.total_owed - returnedTotal;
    const newBalance = Math.max(0, newTotalOwed - freshCredit.amount_paid);
    const isPaid = newBalance <= 0;

    await supabase
      .from('credits')
      .update({
        total_owed: newTotalOwed,
        balance: newBalance,
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .eq('id', creditId);

    // Adjust the sale totals
    const newSaleTotal = freshCredit.sale.total - returnedTotal;
    const newSaleProfit = freshCredit.sale.profit - returnedProfit;
    const newSubtotal = freshCredit.sale.subtotal - returnedTotal;

    await supabase
      .from('sales')
      .update({
        total: newSaleTotal,
        subtotal: newSubtotal,
        profit: newSaleProfit,
        ...(isPaid ? { status: 'completed' } : {}),
      })
      .eq('id', freshCredit.sale_id);
  }

  const pendingCredits = credits.filter((c) => c.status === 'pending');
  const totalPendingAmount = pendingCredits.reduce((sum, c) => sum + c.balance, 0);

  return {
    credits,
    pendingCredits,
    totalPendingAmount,
    loading,
    error,
    markAsPaid,
    markAsReturned,
    partialReturn,
    refresh: fetchCredits,
  };
}

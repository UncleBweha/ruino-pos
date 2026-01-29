import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Credit } from '@/types/database';

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();

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

  async function markAsPaid(creditId: string, amountPaid?: number): Promise<void> {
    if (!user) throw new Error('User not authenticated');

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

    // Update the associated sale status
    if (isPaid) {
      await supabase
        .from('sales')
        .update({ status: 'completed' })
        .eq('id', credit.sale_id);
    }

    // Add to cash box
    await supabase.from('cash_box').insert({
      sale_id: credit.sale_id,
      amount: paymentAmount,
      transaction_type: 'credit_payment',
      description: `Credit payment from ${credit.customer_name}`,
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

    // Return items to inventory
    if (credit.sale?.sale_items) {
      for (const item of credit.sale.sale_items) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ quantity: product.quantity + item.quantity })
            .eq('id', item.product_id);
        }
      }
    }
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
    refresh: fetchCredits,
  };
}

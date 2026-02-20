import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPendingSales, removePendingSale, getPendingSalesCount, type PendingSale } from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingSalesCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may fail silently
    }
  }, []);

  const syncSale = useCallback(async (sale: PendingSale): Promise<boolean> => {
    try {
      // Get a real receipt number
      const { data: receiptNumber, error: rcError } = await supabase.rpc('generate_receipt_number');
      if (rcError) throw rcError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const subtotal = sale.items.reduce((s, i) => s + i.total, 0);
      const taxAmount = subtotal * (sale.taxRate / 100);
      const total = subtotal + taxAmount - sale.discount;
      const profit = sale.items.reduce((s, i) => s + i.profit, 0);
      const status = sale.paymentMethod === 'credit' ? 'credit' : 'completed';

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          receipt_number: receiptNumber,
          cashier_id: sale.cashierId || user.id,
          customer_name: sale.customerName || null,
          customer_id: sale.customerId || null,
          subtotal,
          tax_rate: sale.taxRate,
          tax_amount: taxAmount,
          discount: sale.discount,
          total,
          profit,
          payment_method: sale.paymentMethod,
          status,
          sold_on_behalf_of: sale.soldOnBehalfOf || null,
          sold_on_behalf_name: sale.soldOnBehalfName || null,
          commission_amount: sale.commissionAmount || 0,
          created_at: sale.createdAt,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = sale.items.map((item) => ({
        sale_id: saleData.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        buying_price: item.buyingPrice,
        total: item.total,
        profit: item.profit,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // Stock updates and cash_box / credits
      const ops: PromiseLike<any>[] = [];
      for (const item of sale.items) {
        ops.push(supabase.rpc('update_product_stock', { p_product_id: item.productId, p_quantity_change: -item.quantity }).then());
      }
      if (sale.paymentMethod === 'cash') {
        ops.push(supabase.from('cash_box').insert({ sale_id: saleData.id, amount: total, transaction_type: 'sale', cashier_id: sale.cashierId || user.id }).select().then());
      }
      if (sale.paymentMethod === 'credit' && sale.customerName) {
        ops.push(supabase.from('credits').insert({ sale_id: saleData.id, customer_name: sale.customerName, total_owed: total, amount_paid: 0, balance: total, status: 'pending' }).select().then());
      }
      await Promise.all(ops);

      return true;
    } catch (err) {
      console.error('Sync sale failed:', err);
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const pending = await getPendingSales();
      let synced = 0;

      for (const sale of pending) {
        const ok = await syncSale(sale);
        if (ok && sale.offlineId != null) {
          await removePendingSale(sale.offlineId);
          synced++;
        }
      }

      if (synced > 0) {
        toast({
          title: 'Sales Synced',
          description: `${synced} offline sale${synced > 1 ? 's' : ''} synced successfully`,
        });
      }
    } catch (err) {
      console.error('Sync all failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [syncSale, toast, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncAll();
    }
  }, [isOnline, syncAll]);

  // Refresh count on mount
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { pendingCount, syncing, syncAll, refreshCount, isOnline };
}

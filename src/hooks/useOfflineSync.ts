import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingSales, removePendingSale, getPendingSalesCount,
  getPendingOps, removePendingOp, getPendingOpsCount,
  type PendingSale, type PendingOp,
} from '@/lib/offlineDb';
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
      const [salesCount, opsCount] = await Promise.all([
        getPendingSalesCount(),
        getPendingOpsCount(),
      ]);
      setPendingCount(salesCount + opsCount);
    } catch {
      // IndexedDB may fail silently
    }
  }, []);

  const syncSale = useCallback(async (sale: PendingSale): Promise<boolean> => {
    try {
      const { data: receiptNumber, error: rcError } = await supabase.rpc('generate_receipt_number');
      if (rcError) throw rcError;

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

  const syncOp = useCallback(async (op: PendingOp): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      switch (op.type) {
        case 'create_customer': {
          const { error } = await supabase.from('customers').insert(op.payload);
          if (error) throw error;
          break;
        }
        case 'create_supplier': {
          const { error } = await supabase.from('suppliers').insert(op.payload);
          if (error) throw error;
          break;
        }
        case 'create_casual': {
          const { error } = await supabase.from('casuals').insert({
            ...op.payload,
            created_by: user.id,
          });
          if (error) throw error;
          break;
        }
        case 'add_stock': {
          const { productId, quantity } = op.payload;
          const { error } = await supabase.rpc('update_product_stock', {
            p_product_id: productId,
            p_quantity_change: quantity,
          });
          if (error) throw error;
          break;
        }
        default:
          console.warn('Unknown pending op type:', op.type);
          return false;
      }
      return true;
    } catch (err) {
      console.error(`Sync op (${op.type}) failed:`, err);
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    let totalSynced = 0;

    try {
      // 1. Sync pending operations first (customers/casuals/suppliers might be referenced by sales)
      const pendingOps = await getPendingOps();
      for (const op of pendingOps) {
        const ok = await syncOp(op);
        if (ok && op.offlineId != null) {
          await removePendingOp(op.offlineId);
          totalSynced++;
        }
      }

      // 2. Sync pending sales
      const pending = await getPendingSales();
      for (const sale of pending) {
        const ok = await syncSale(sale);
        if (ok && sale.offlineId != null) {
          await removePendingSale(sale.offlineId);
          totalSynced++;
        }
      }

      if (totalSynced > 0) {
        toast({
          title: 'Offline Data Synced',
          description: `${totalSynced} offline operation${totalSynced > 1 ? 's' : ''} synced successfully`,
        });
      }
    } catch (err) {
      console.error('Sync all failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [syncSale, syncOp, toast, refreshCount]);

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

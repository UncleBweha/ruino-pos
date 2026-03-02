import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingSales, removePendingSale, getPendingSalesCount,
  getPendingOps, removePendingOp, getPendingOpsCount,
  type PendingSale, type PendingOp,
} from '@/lib/offlineDb';
import { getSyncMeta, recordSuccessfulSync, addSyncError, type SyncMeta } from '@/lib/syncMeta';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMeta, setSyncMetaState] = useState<SyncMeta>(getSyncMeta());
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const [salesCount, opsCount] = await Promise.all([
        getPendingSalesCount(),
        getPendingOpsCount(),
      ]);
      setPendingCount(salesCount + opsCount);
      setSyncMetaState(getSyncMeta());
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
      addSyncError({
        type: 'sale',
        message: err instanceof Error ? err.message : 'Sale sync failed',
        payload: { receipt: sale.offlineReceipt },
      });
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
        case 'create_product': {
          const { error } = await supabase.from('products').insert(op.payload);
          if (error) throw error;
          break;
        }
        case 'create_category': {
          const { error } = await supabase.from('categories').insert(op.payload);
          if (error) throw error;
          break;
        }
        case 'update_entity': {
          const { table, id, updates } = op.payload;
          const { error } = await supabase.from(table).update(updates).eq('id', id);
          if (error) throw error;
          break;
        }
        case 'delete_entity': {
          const { table, id: entityId } = op.payload;
          const { error } = await supabase.from(table).delete().eq('id', entityId);
          if (error) throw error;
          break;
        }
        case 'create_invoice': {
          const p = op.payload;
          const subtotal = p.items.reduce((sum: number, item: any) => sum + item.quantity * item.unit_price, 0);
          const taxAmount = subtotal * (p.tax_rate / 100);
          const total = subtotal + taxAmount;

          const { data: invoiceNumber, error: numError } = await supabase.rpc('generate_invoice_number', { doc_type: p.type });
          if (numError) throw numError;

          const { data: invoiceData, error: invError } = await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              type: p.type,
              customer_name: p.customer_name,
              customer_phone: p.customer_phone || null,
              customer_address: p.customer_address || null,
              customer_id: p.customer_id || null,
              subtotal,
              tax_rate: p.tax_rate,
              tax_amount: taxAmount,
              total,
              payment_terms: p.payment_terms || null,
              notes: p.notes || null,
              created_by: p.created_by || user.id,
              converted_from: p.converted_from || null,
              logo_url: p.logo_url || null,
            })
            .select()
            .single();
          if (invError) throw invError;

          const invoiceItems = p.items.map((item: any) => ({
            invoice_id: invoiceData.id,
            product_name: item.product_name,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }));

          const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
          if (itemsError) throw itemsError;
          break;
        }
        case 'credit_payment': {
          const cp = op.payload;
          // Fetch fresh credit
          const { data: freshCredit, error: fcError } = await supabase
            .from('credits')
            .select('*')
            .eq('id', cp.creditId)
            .maybeSingle();
          if (fcError) throw fcError;
          if (!freshCredit) throw new Error('Credit not found during sync');

          const paymentAmount = cp.amountPaid;
          const newAmountPaid = freshCredit.amount_paid + paymentAmount;
          const newBalance = freshCredit.total_owed - newAmountPaid;
          const isPaid = newBalance <= 0;

          await supabase.from('credits').update({
            amount_paid: newAmountPaid,
            balance: Math.max(0, newBalance),
            status: isPaid ? 'paid' : 'pending',
            paid_at: isPaid ? new Date().toISOString() : null,
          }).eq('id', cp.creditId);

          await supabase.from('credit_payments').insert({
            credit_id: cp.creditId,
            amount: paymentAmount,
            payment_method: cp.paymentMethod,
            cashier_id: cp.cashierId,
          });

          if (isPaid) {
            await supabase.from('sales').update({
              status: 'completed',
              payment_method: `credit_${cp.paymentMethod}`,
            }).eq('id', cp.saleId);
          }

          await supabase.from('cash_box').insert({
            sale_id: cp.saleId,
            amount: paymentAmount,
            transaction_type: 'credit_payment',
            description: `Credit payment from ${cp.customerName} via ${cp.paymentMethod}`,
            cashier_id: cp.cashierId,
          });
          break;
        }
        default:
          console.warn('Unknown pending op type:', op.type);
          return false;
      }
      return true;
    } catch (err) {
      console.error(`Sync op (${op.type}) failed:`, err);
      addSyncError({
        type: op.type,
        message: err instanceof Error ? err.message : `${op.type} sync failed`,
        payload: { tempId: op.tempId },
      });
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    let totalSynced = 0;

    try {
      // 1. Sync pending operations first (entities before sales)
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
        recordSuccessfulSync(totalSynced);
        toast({
          title: 'Offline Data Synced',
          description: `${totalSynced} item${totalSynced > 1 ? 's' : ''} synced successfully`,
        });
      }
    } catch (err) {
      console.error('Sync all failed:', err);
      addSyncError({
        type: 'sync_all',
        message: err instanceof Error ? err.message : 'Bulk sync failed',
      });
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

  // Periodic retry when online with pending items (every 30s)
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(async () => {
      const [sc, oc] = await Promise.all([getPendingSalesCount(), getPendingOpsCount()]);
      if (sc + oc > 0) {
        syncAll();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isOnline, syncAll]);

  // Refresh count on mount
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { pendingCount, syncing, syncAll, refreshCount, isOnline, syncMeta };
}

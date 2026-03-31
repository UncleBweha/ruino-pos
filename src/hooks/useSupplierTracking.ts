import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SupplierPayment, ReturnDamage, SupplierProductExtended } from '@/types/supplier-tracking';

export function useSupplierPayments(supplierId?: string) {
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase.from('supplier_payments').select('*').order('payment_date', { ascending: false });
    if (supplierId) query = query.eq('supplier_id', supplierId);
    const { data, error } = await query;
    if (!error) setPayments((data || []) as unknown as SupplierPayment[]);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function addPayment(payment: {
    supplier_id: string;
    supply_record_id?: string;
    amount: number;
    payment_method?: string;
    notes?: string;
    created_by: string;
  }) {
    const { data, error } = await supabase.from('supplier_payments').insert(payment).select().single();
    if (error) throw error;

    // Update supply record balance if linked
    if (payment.supply_record_id) {
      const { data: record } = await supabase
        .from('supplier_products')
        .select('amount_paid, total_amount')
        .eq('id', payment.supply_record_id)
        .single();

      if (record) {
        const newPaid = (record as any).amount_paid + payment.amount;
        const newBalance = (record as any).total_amount - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';
        await supabase.from('supplier_products').update({
          amount_paid: newPaid,
          balance: Math.max(0, newBalance),
          payment_status: newStatus,
          ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
        }).eq('id', payment.supply_record_id);
      }
    }

    await fetch();
    return data as unknown as SupplierPayment;
  }

  return { payments, loading, addPayment, refresh: fetch };
}

export function useReturnsDamages(supplierId?: string) {
  const [returns, setReturns] = useState<ReturnDamage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase.from('returns_damages').select('*').order('date_returned', { ascending: false });
    if (supplierId) query = query.eq('supplier_id', supplierId);
    const { data, error } = await query;
    if (!error) setReturns((data || []) as unknown as ReturnDamage[]);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function addReturn(record: {
    supplier_id: string;
    supply_record_id?: string;
    product_id?: string;
    product_name: string;
    quantity: number;
    type: 'returned' | 'damaged';
    reason?: string;
    resolution?: 'refund' | 'replacement';
    notes?: string;
    created_by: string;
  }) {
    const { data, error } = await supabase.from('returns_damages').insert({
      ...record,
      stock_adjusted: !!record.product_id,
    }).select().single();
    if (error) throw error;

    // Auto-adjust stock if product_id provided
    if (record.product_id) {
      const { data: prod } = await supabase.from('products').select('quantity, damaged_quantity').eq('id', record.product_id).single();
      if (prod) {
        if (record.resolution === 'replacement') {
          await supabase.from('products').update({
            quantity: (prod.quantity || 0) + record.quantity,
            damaged_quantity: Math.max(0, (prod.damaged_quantity || 0) - record.quantity)
          }).eq('id', record.product_id);
        } else {
          // Refund
          await supabase.from('products').update({
            damaged_quantity: Math.max(0, (prod.damaged_quantity || 0) - record.quantity)
          }).eq('id', record.product_id);
        }
      }
    }

    await fetch();
    return data as unknown as ReturnDamage;
  }

  return { returns, loading, addReturn, refresh: fetch };
}

export function useGoodsReceipt() {
  async function createGoodsReceipt(record: {
    supplier_id: string;
    product_name: string;
    product_id?: string;
    quantity: number;
    buying_price: number;
    total_amount: number;
    payment_status?: string;
    due_date?: string;
    batch_reference?: string;
    notes?: string;
    destination?: 'warehouse' | 'shop';
  }) {
    // Generate GRN number
    const { data: grnData } = await supabase.rpc('generate_grn_number');
    const grn_number = grnData || `GRN-${Date.now()}`;

    const { data, error } = await supabase.from('supplier_products').insert({
      ...record,
      grn_number,
      balance: record.total_amount,
      amount_paid: 0,
    }).select().single();
    if (error) throw error;

    // Auto-update stock if product_id linked
    if (record.product_id) {
      if (record.destination === 'shop') {
        await supabase.rpc('update_product_stock', {
          p_product_id: record.product_id,
          p_quantity_change: record.quantity,
        });
      } else {
        const { data: prod } = await supabase.from('products').select('warehouse_quantity').eq('id', record.product_id).single();
        if (prod) {
          await supabase.from('products').update({
            warehouse_quantity: (prod.warehouse_quantity || 0) + record.quantity
          }).eq('id', record.product_id);
        }
      }
    }

    return data as unknown as SupplierProductExtended;
  }

  return { createGoodsReceipt };
}

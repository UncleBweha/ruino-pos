import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Sale, CartItem } from '@/types/database';

interface CreateSaleParams {
  items: CartItem[];
  customerName?: string;
  customerId?: string;
  taxRate: number;
  discount: number;
  paymentMethod: 'cash' | 'mpesa' | 'credit';
  soldOnBehalfOf?: string | null;
  soldOnBehalfName?: string | null;
  commissionAmount?: number;
}

export function useSales() {
  const { user, isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    if (!user) return;

    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      const cashierIds = [...new Set(salesData?.map(s => s.cashier_id) || [])];
      
      let profilesMap = new Map();
      if (cashierIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', cashierIds);
        profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      }

      const salesWithCashier = salesData?.map(sale => ({
        ...sale,
        cashier: profilesMap.get(sale.cashier_id) || null
      })) || [];

      setSales(salesWithCashier as Sale[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSales();

    const channel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSales]);

  async function generateReceiptNumber(): Promise<string> {
    const { data, error } = await supabase.rpc('generate_receipt_number');
    
    if (error) {
      throw new Error('Failed to generate receipt number: ' + error.message);
    }
    
    return data as string;
  }

  async function createSale(params: CreateSaleParams): Promise<Sale> {
    if (!user) throw new Error('User not authenticated');

    const { items, customerName, customerId, taxRate, discount, paymentMethod, soldOnBehalfOf, soldOnBehalfName, commissionAmount } = params;

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    const profit = items.reduce((sum, item) => sum + item.profit, 0);

    const receiptNumber = await generateReceiptNumber();
    const status = paymentMethod === 'credit' ? 'credit' : 'completed';

    if (paymentMethod === 'credit' && !customerName?.trim()) {
      throw new Error('Customer name is required for credit sales');
    }

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNumber,
        cashier_id: user.id,
        customer_name: customerName || null,
        customer_id: customerId || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount,
        total,
        profit,
        payment_method: paymentMethod,
        status,
        sold_on_behalf_of: soldOnBehalfOf || null,
        sold_on_behalf_name: soldOnBehalfName || null,
        commission_amount: commissionAmount || 0,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    const saleId = saleData.id;

    const saleItems = items.map((item) => ({
      sale_id: saleId,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      buying_price: item.product.buying_price,
      total: item.total,
      profit: item.profit,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    const parallelOps: PromiseLike<any>[] = [];

    for (const item of items) {
      parallelOps.push(
        supabase.rpc('update_product_stock', {
          p_product_id: item.product.id,
          p_quantity_change: -item.quantity,
        }).then()
      );
    }

    if (paymentMethod === 'cash') {
      parallelOps.push(
        supabase.from('cash_box').insert({
          sale_id: saleId,
          amount: total,
          transaction_type: 'sale',
          cashier_id: user.id,
        }).select().then()
      );
    }

    if (paymentMethod === 'credit') {
      parallelOps.push(
        supabase.from('credits').insert({
          sale_id: saleId,
          customer_name: customerName!,
          total_owed: total,
          amount_paid: 0,
          balance: total,
          status: 'pending',
        }).select().then()
      );
    }

    await Promise.all(parallelOps);

    const { data: completeSale, error: fetchError } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', saleId)
      .single();

    if (fetchError) throw fetchError;

    return completeSale as Sale;
  }

  async function voidSale(saleId: string): Promise<void> {
    if (!user || !isAdmin) throw new Error('Unauthorized');

    const sale = sales.find((s) => s.id === saleId);
    if (!sale) throw new Error('Sale not found');

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
      })
      .eq('id', saleId);

    if (updateError) throw updateError;

    if (sale.sale_items) {
      await Promise.all(
        sale.sale_items.map(item =>
          supabase.rpc('update_product_stock', {
            p_product_id: item.product_id,
            p_quantity_change: item.quantity,
          })
        )
      );
    }
  }

  return {
    sales,
    loading,
    error,
    createSale,
    voidSale,
    refresh: fetchSales,
  };
}

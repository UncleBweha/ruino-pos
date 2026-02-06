import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Sale, SaleItem, CartItem, Credit } from '@/types/database';

interface CreateSaleParams {
  items: CartItem[];
  customerName?: string;
  taxRate: number;
  discount: number;
  paymentMethod: 'cash' | 'mpesa' | 'credit';
}

export function useSales() {
  const { user, isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch cashier profiles for all unique cashier IDs
      const cashierIds = [...new Set(salesData?.map(s => s.cashier_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', cashierIds);

      // Map profiles by user_id for quick lookup
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      // Combine sales with cashier info
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

    // Set up realtime subscription
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
    // Use the database function to generate receipt number atomically
    const { data, error } = await supabase.rpc('generate_receipt_number');
    
    if (error) {
      throw new Error('Failed to generate receipt number: ' + error.message);
    }
    
    return data as string;
  }

  async function createSale(params: CreateSaleParams): Promise<Sale> {
    if (!user) throw new Error('User not authenticated');

    const { items, customerName, taxRate, discount, paymentMethod } = params;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    const profit = items.reduce((sum, item) => sum + item.profit, 0);

    // Generate receipt number
    const receiptNumber = await generateReceiptNumber();

    // Determine status
    const status = paymentMethod === 'credit' ? 'credit' : 'completed';

    // Validate credit sale requires customer name
    if (paymentMethod === 'credit' && !customerName?.trim()) {
      throw new Error('Customer name is required for credit sales');
    }

    // Create sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNumber,
        cashier_id: user.id,
        customer_name: customerName || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount,
        total,
        profit,
        payment_method: paymentMethod,
        status,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    const saleId = saleData.id;

    // Create sale items - use the custom unitPrice from cart
    const saleItems = items.map((item) => ({
      sale_id: saleId,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice, // Use custom price instead of product.selling_price
      buying_price: item.product.buying_price,
      total: item.total,
      profit: item.profit,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // Update stock, cash box, and credits in parallel for speed
    const parallelOps: PromiseLike<any>[] = [];

    // Stock updates - all in parallel
    for (const item of items) {
      parallelOps.push(
        supabase.rpc('update_product_stock', {
          p_product_id: item.product.id,
          p_quantity_change: -item.quantity,
        }).then()
      );
    }

    // Cash box insert for cash payments
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

    // Credit record for credit sales
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

    // Fetch the complete sale with items to return with correct prices
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

    // Update sale status
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
      })
      .eq('id', saleId);

    if (updateError) throw updateError;

    // Return items to inventory using secure function
    if (sale.sale_items) {
      for (const item of sale.sale_items) {
        const { error: stockError } = await supabase.rpc('update_product_stock', {
          p_product_id: item.product_id,
          p_quantity_change: item.quantity, // Positive to restore
        });

        if (stockError) console.error('Stock restore error:', stockError);
      }
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

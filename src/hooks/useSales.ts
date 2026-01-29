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
      let query = supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      // Cashiers can only see their own sales
      if (!isAdmin) {
        query = query.eq('cashier_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSales(data as Sale[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

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
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of today's sales
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString());

    const seqNum = ((count || 0) + 1).toString().padStart(4, '0');
    return `RGM${dateStr}${seqNum}`;
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

    const sale = saleData as Sale;

    // Create sale items
    const saleItems = items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      buying_price: item.product.buying_price,
      total: item.total,
      profit: item.profit,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // Update product quantities
    for (const item of items) {
      const { error: stockError } = await supabase
        .from('products')
        .update({ quantity: item.product.quantity - item.quantity })
        .eq('id', item.product.id);

      if (stockError) console.error('Stock update error:', stockError);
    }

    // Handle cash payment - add to cash box
    if (paymentMethod === 'cash') {
      await supabase.from('cash_box').insert({
        sale_id: sale.id,
        amount: total,
        transaction_type: 'sale',
        cashier_id: user.id,
      });
    }

    // Handle credit sale - create credit record
    if (paymentMethod === 'credit') {
      await supabase.from('credits').insert({
        sale_id: sale.id,
        customer_name: customerName!,
        total_owed: total,
        amount_paid: 0,
        balance: total,
        status: 'pending',
      });
    }

    return sale;
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

    // Return items to inventory
    if (sale.sale_items) {
      for (const item of sale.sale_items) {
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

  return {
    sales,
    loading,
    error,
    createSale,
    voidSale,
    refresh: fetchSales,
  };
}

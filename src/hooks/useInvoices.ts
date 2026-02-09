import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Invoice, InvoiceItem } from '@/types/database';

interface CreateInvoiceParams {
  type: 'invoice' | 'quotation';
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_id?: string;
  items: { product_name: string; description?: string; quantity: number; unit_price: number }[];
  tax_rate: number;
  payment_terms?: string;
  notes?: string;
  converted_from?: string;
  logo_url?: string;
}

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data || []) as unknown as Invoice[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function generateInvoiceNumber(type: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_invoice_number', { doc_type: type });
    if (error) throw error;
    return data as string;
  }

  async function createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    if (!user) throw new Error('User not authenticated');

    const subtotal = params.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const taxAmount = subtotal * (params.tax_rate / 100);
    const total = subtotal + taxAmount;

    const invoiceNumber = await generateInvoiceNumber(params.type);

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        type: params.type,
        customer_name: params.customer_name,
        customer_phone: params.customer_phone || null,
        customer_address: params.customer_address || null,
        customer_id: params.customer_id || null,
        subtotal,
        tax_rate: params.tax_rate,
        tax_amount: taxAmount,
        total,
        payment_terms: params.payment_terms || null,
        notes: params.notes || null,
        created_by: user.id,
        converted_from: params.converted_from || null,
        logo_url: params.logo_url || null,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const invoiceItems = params.items.map((item) => ({
      invoice_id: invoiceData.id,
      product_name: item.product_name,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) throw itemsError;

    await fetchInvoices();

    const { data: complete } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceData.id)
      .single();

    return complete as unknown as Invoice;
  }

  async function updateInvoiceStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .update({ payment_status: status })
      .eq('id', id);

    if (error) throw error;
    await fetchInvoices();
  }

  async function convertToInvoice(quotationId: string): Promise<Invoice> {
    const quotation = invoices.find((i) => i.id === quotationId);
    if (!quotation) throw new Error('Quotation not found');
    if (quotation.type !== 'quotation') throw new Error('Can only convert quotations');

    return createInvoice({
      type: 'invoice',
      customer_name: quotation.customer_name,
      customer_phone: quotation.customer_phone || undefined,
      customer_address: quotation.customer_address || undefined,
      customer_id: quotation.customer_id || undefined,
      items: (quotation.invoice_items || []).map((item) => ({
        product_name: item.product_name,
        description: item.description || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      tax_rate: quotation.tax_rate,
      payment_terms: quotation.payment_terms || undefined,
      notes: quotation.notes || undefined,
      converted_from: quotation.id,
    });
  }

  async function deleteInvoice(id: string): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchInvoices();
  }

  return {
    invoices,
    loading,
    error,
    createInvoice,
    updateInvoiceStatus,
    convertToInvoice,
    deleteInvoice,
    refresh: fetchInvoices,
  };
}

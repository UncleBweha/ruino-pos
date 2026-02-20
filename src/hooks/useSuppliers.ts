import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Supplier, SupplierProduct } from '@/types/database';
import { cacheSuppliers, getCachedSuppliers } from '@/lib/offlineDb';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*, supplier_products(*)')
        .order('name');

      if (error) throw error;
      setSuppliers((data || []) as unknown as Supplier[]);
      cacheSuppliers(data || []).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch suppliers, checking cache...', err);
      try {
        const cached = await getCachedSuppliers();
        if (cached && cached.length > 0) {
          setSuppliers(cached as unknown as Supplier[]);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedSuppliers();
        if (cached && cached.length > 0) {
          setSuppliers(cached as unknown as Supplier[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial suppliers cache load error:', err);
      }

      // 2. Fetch fresh data in background
      await fetchSuppliers();
    }
    init();
  }, [fetchSuppliers]);

  async function createSupplier(supplier: { name: string; phone?: string; email?: string; payment_terms?: number; notes?: string }): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();

    if (error) throw error;
    await fetchSuppliers();
    return data as unknown as Supplier;
  }

  async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
    const { error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchSuppliers();
  }

  async function deleteSupplier(id: string): Promise<void> {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchSuppliers();
  }

  async function addSupplyRecord(record: {
    supplier_id: string;
    product_name: string;
    quantity: number;
    buying_price: number;
    total_amount: number;
    payment_status?: string;
    due_date?: string;
    notes?: string;
  }): Promise<SupplierProduct> {
    const { data, error } = await supabase
      .from('supplier_products')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    await fetchSuppliers();
    return data as unknown as SupplierProduct;
  }

  async function updateSupplyPayment(id: string, status: 'paid' | 'unpaid'): Promise<void> {
    const updates: any = { payment_status: status };
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('supplier_products')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchSuppliers();
  }

  async function deleteSupplyRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('supplier_products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchSuppliers();
  }

  return {
    suppliers,
    loading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    addSupplyRecord,
    updateSupplyPayment,
    deleteSupplyRecord,
    refresh: fetchSuppliers,
  };
}

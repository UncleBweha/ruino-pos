import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Customer } from '@/types/database';
import { cacheCustomers, getCachedCustomers, addCachedCustomer, queueOp } from '@/lib/offlineDb';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setError(null);
      setCustomers((data || []) as Customer[]);
      cacheCustomers(data || []).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch customers, checking cache...', err);
      try {
        const cached = await getCachedCustomers();
        if (cached && cached.length > 0) {
          setCustomers(cached as Customer[]);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }

      if (!navigator.onLine) {
        setError('Working Offline');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch customers');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const cached = await getCachedCustomers();
        if (cached && cached.length > 0) {
          setCustomers(cached as Customer[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial customers cache load error:', err);
      }
      await fetchCustomers();
    }
    init();
  }, [fetchCustomers]);

  async function createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    if (!navigator.onLine) {
      // Create locally with temp ID
      const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      const localCustomer: Customer = {
        id: tempId,
        ...customer,
        created_at: now,
        updated_at: now,
      };

      // Add to local state + cache + queue
      setCustomers(prev => [...prev, localCustomer]);
      await addCachedCustomer(localCustomer);
      await queueOp({
        type: 'create_customer',
        payload: customer,
        createdAt: now,
        tempId,
      });

      return localCustomer;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    await fetchCustomers();
    return data as Customer;
  }

  async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchCustomers();
  }

  async function deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchCustomers();
  }

  function searchCustomers(query: string): Customer[] {
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.business_name?.toLowerCase().includes(q)
    );
  }

  async function getCustomerSales(customerId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  return {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers,
    getCustomerSales,
    refresh: fetchCustomers,
  };
}

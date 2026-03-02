import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheCasuals, getCachedCasuals } from '@/lib/offlineDb';
import type { Casual } from '@/types/database';

interface CreateCasualParams {
  full_name: string;
  phone?: string;
  commission_rate: number;
  commission_type: 'percentage' | 'fixed';
}

export function useCasuals() {
  const [casuals, setCasuals] = useState<Casual[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCasuals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('casuals')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setCasuals((data || []) as Casual[]);
      cacheCasuals(data || []).catch(console.error);
    } catch (error) {
      console.error('Failed to fetch casuals, checking cache...', error);
      try {
        const cached = await getCachedCasuals();
        if (cached && cached.length > 0) {
          setCasuals(cached as Casual[]);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedCasuals();
        if (cached && cached.length > 0) {
          setCasuals(cached as Casual[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial casuals cache load error:', err);
      }

      // 2. Fetch fresh data in background
      await fetchCasuals();
    }
    init();
  }, [fetchCasuals]);

  const activeCasuals = casuals.filter(c => c.status === 'active');

  async function createCasual(params: CreateCasualParams) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('casuals')
      .insert({
        full_name: params.full_name,
        phone: params.phone || null,
        commission_rate: params.commission_rate,
        commission_type: params.commission_type,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    toast({ title: 'Casual Added', description: `${params.full_name} has been added` });
    await fetchCasuals();
    return data as Casual;
  }

  async function updateCasual(id: string, updates: Partial<CreateCasualParams & { status: 'active' | 'inactive' }>) {
    const { error } = await supabase
      .from('casuals')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    toast({ title: 'Casual Updated', description: 'Profile has been updated' });
    await fetchCasuals();
  }

  async function deleteCasual(id: string) {
    const { error } = await supabase
      .from('casuals')
      .delete()
      .eq('id', id);

    if (error) throw error;

    toast({ title: 'Casual Removed', description: 'Profile has been deleted' });
    await fetchCasuals();
  }

  return {
    casuals,
    activeCasuals,
    loading,
    refresh: fetchCasuals,
    createCasual,
    updateCasual,
    deleteCasual,
  };
}

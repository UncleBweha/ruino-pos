import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
    } catch (error) {
      console.error('Error fetching casuals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCasuals();
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

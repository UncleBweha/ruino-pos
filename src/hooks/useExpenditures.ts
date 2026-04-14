import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Expenditure {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string;
  expense_date: string;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryRecord {
  id: string;
  user_id: string;
  full_name: string;
  month: string;
  amount: number;
  payment_method: string;
  payment_date: string | null;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface CasualWageEntry {
  id: string;
  casual_id: string;
  casual_name: string;
  work_date: string;
  amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'wifi', label: 'WiFi/Internet' },
  { id: 'transport', label: 'Transport' },
  { id: 'miscellaneous', label: 'Miscellaneous' },
] as const;

export function useExpenditures() {
  const { user } = useAuth();
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [casualWages, setCasualWages] = useState<CasualWageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: exp }, { data: sal }, { data: wages }] = await Promise.all([
        supabase.from('expenditures').select('*').order('expense_date', { ascending: false }),
        supabase.from('salary_records').select('*').order('created_at', { ascending: false }),
        supabase.from('casual_wage_entries').select('*').order('work_date', { ascending: false }),
      ]);
      setExpenditures((exp as Expenditure[]) || []);
      setSalaryRecords((sal as SalaryRecord[]) || []);
      setCasualWages((wages as CasualWageEntry[]) || []);
    } catch (err) {
      console.error('Expenditures fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Expenditures CRUD ---
  async function addExpenditure(data: Omit<Expenditure, 'id' | 'created_at' | 'updated_at' | 'created_by'>) {
    const { error } = await supabase.from('expenditures').insert({
      ...data,
      created_by: user!.id,
    } as any);
    if (error) throw error;
    await fetchAll();
  }

  async function updateExpenditure(id: string, data: Partial<Expenditure>) {
    const { error } = await supabase.from('expenditures').update(data as any).eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  async function deleteExpenditure(id: string) {
    const { error } = await supabase.from('expenditures').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  // --- Salary CRUD ---
  async function addSalaryRecord(data: Omit<SalaryRecord, 'id' | 'created_at' | 'created_by'>) {
    const { error } = await supabase.from('salary_records').insert({
      ...data,
      created_by: user!.id,
    } as any);
    if (error) throw error;
    await fetchAll();
  }

  async function updateSalaryRecord(id: string, data: Partial<SalaryRecord>) {
    const { error } = await supabase.from('salary_records').update(data as any).eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  async function deleteSalaryRecord(id: string) {
    const { error } = await supabase.from('salary_records').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  // --- Casual Wages CRUD ---
  async function addCasualWage(data: Omit<CasualWageEntry, 'id' | 'created_at' | 'created_by'>) {
    const { error } = await supabase.from('casual_wage_entries').insert({
      ...data,
      created_by: user!.id,
    } as any);
    if (error) throw error;
    await fetchAll();
  }

  async function updateCasualWage(id: string, data: Partial<CasualWageEntry>) {
    const { error } = await supabase.from('casual_wage_entries').update(data as any).eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  async function deleteCasualWage(id: string) {
    const { error } = await supabase.from('casual_wage_entries').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }

  // --- Summaries ---
  function getMonthlyExpenditure(month: string) {
    const expTotal = expenditures
      .filter(e => e.expense_date.startsWith(month))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const salTotal = salaryRecords
      .filter(s => s.month === month)
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const wageTotal = casualWages
      .filter(w => w.work_date.startsWith(month))
      .reduce((sum, w) => sum + Number(w.amount), 0);
    return expTotal + salTotal + wageTotal;
  }

  function getTodayExpenditure() {
    const today = new Date().toISOString().split('T')[0];
    const expTotal = expenditures
      .filter(e => e.expense_date.startsWith(today))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const wageTotal = casualWages
      .filter(w => w.work_date === today)
      .reduce((sum, w) => sum + Number(w.amount), 0);
    return expTotal + wageTotal;
  }

  return {
    expenditures, salaryRecords, casualWages, loading,
    addExpenditure, updateExpenditure, deleteExpenditure,
    addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
    addCasualWage, updateCasualWage, deleteCasualWage,
    getMonthlyExpenditure, getTodayExpenditure,
    refresh: fetchAll,
  };
}

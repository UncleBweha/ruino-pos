import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DailyReportData {
  // Sales summary
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  avgTransactionValue: number;
  // Payment breakdown
  cashSales: number;
  mpesaSales: number;
  creditSales: number;
  cashCount: number;
  mpesaCount: number;
  creditCount: number;
  // Top products
  topProducts: { product_name: string; total_quantity: number; total_revenue: number; total_profit: number }[];
  // Best cashiers
  bestCashiers: { cashier_id: string; cashier_name: string; total_sales: number; total_profit: number; transaction_count: number }[];
  // Hourly breakdown for chart
  hourlySales: { hour: string; sales: number; transactions: number }[];
  // Voided sales
  voidedCount: number;
  voidedAmount: number;
}

export function useReports() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (date: Date) => {
    if (!user) return;
    setLoading(true);

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const startISO = startOfDay.toISOString();
      const endISO = endOfDay.toISOString();

      // Fetch all data in parallel
      const [
        { data: salesData },
        { data: saleItemsRaw },
        { data: voidedData },
      ] = await Promise.all([
        supabase
          .from('sales')
          .select('id, total, profit, payment_method, cashier_id, created_at, status')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('sale_items')
          .select('product_name, quantity, total, profit, sale_id')
          .in('sale_id',
            (await supabase
              .from('sales')
              .select('id')
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .neq('status', 'voided')
            ).data?.map(s => s.id) || []
          ),
        supabase
          .from('sales')
          .select('total')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .eq('status', 'voided'),
      ]);

      const completedSales = salesData?.filter(s => s.status !== 'voided') || [];

      // Totals
      const totalSales = completedSales.reduce((sum, s) => sum + Number(s.total), 0);
      const totalProfit = completedSales.reduce((sum, s) => sum + Number(s.profit), 0);
      const totalTransactions = completedSales.length;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      // Payment breakdown
      const cashSales = completedSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + Number(s.total), 0);
      const mpesaSales = completedSales.filter(s => s.payment_method === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0);
      const creditSales = completedSales.filter(s => s.payment_method === 'credit').reduce((sum, s) => sum + Number(s.total), 0);
      const cashCount = completedSales.filter(s => s.payment_method === 'cash').length;
      const mpesaCount = completedSales.filter(s => s.payment_method === 'mpesa').length;
      const creditCount = completedSales.filter(s => s.payment_method === 'credit').length;

      // Top products
      const productMap = new Map<string, { product_name: string; total_quantity: number; total_revenue: number; total_profit: number }>();
      (saleItemsRaw || []).forEach(item => {
        const existing = productMap.get(item.product_name) || { product_name: item.product_name, total_quantity: 0, total_revenue: 0, total_profit: 0 };
        existing.total_quantity += item.quantity;
        existing.total_revenue += Number(item.total);
        existing.total_profit += Number(item.profit);
        productMap.set(item.product_name, existing);
      });
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Best cashiers
      const cashierIds = [...new Set(completedSales.map(s => s.cashier_id))];
      let profilesMap = new Map<string, string>();
      if (cashierIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', cashierIds);
        profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      }

      const cashierMap = new Map<string, { cashier_id: string; cashier_name: string; total_sales: number; total_profit: number; transaction_count: number }>();
      completedSales.forEach(sale => {
        const existing = cashierMap.get(sale.cashier_id) || {
          cashier_id: sale.cashier_id,
          cashier_name: profilesMap.get(sale.cashier_id) || 'Unknown',
          total_sales: 0,
          total_profit: 0,
          transaction_count: 0,
        };
        existing.total_sales += Number(sale.total);
        existing.total_profit += Number(sale.profit);
        existing.transaction_count += 1;
        cashierMap.set(sale.cashier_id, existing);
      });
      const bestCashiers = Array.from(cashierMap.values())
        .sort((a, b) => b.total_sales - a.total_sales);

      // Hourly breakdown
      const hourlyMap = new Map<number, { sales: number; transactions: number }>();
      for (let h = 6; h <= 22; h++) hourlyMap.set(h, { sales: 0, transactions: 0 });
      completedSales.forEach(sale => {
        const hour = new Date(sale.created_at).getHours();
        const existing = hourlyMap.get(hour) || { sales: 0, transactions: 0 };
        existing.sales += Number(sale.total);
        existing.transactions += 1;
        hourlyMap.set(hour, existing);
      });
      const hourlySales = Array.from(hourlyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, data]) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          sales: data.sales,
          transactions: data.transactions,
        }));

      // Voided
      const voidedCount = voidedData?.length || 0;
      const voidedAmount = voidedData?.reduce((sum, s) => sum + Number(s.total), 0) || 0;

      setReport({
        totalSales, totalProfit, totalTransactions, avgTransactionValue,
        cashSales, mpesaSales, creditSales, cashCount, mpesaCount, creditCount,
        topProducts, bestCashiers, hourlySales,
        voidedCount, voidedAmount,
      });
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate, fetchReport]);

  return {
    report,
    loading,
    selectedDate,
    setSelectedDate,
    refresh: () => fetchReport(selectedDate),
  };
}

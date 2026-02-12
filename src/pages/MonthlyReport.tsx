import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { generatePDFFromHTML, printHTML } from '@/lib/pdfUtils';
import {
  ArrowLeft, Printer, Download, Loader2, TrendingUp, Users, Package,
  CreditCard, DollarSign, ShoppingCart, AlertTriangle, Truck, Clock,
  Trophy, Star, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MonthlyReportData {
  month: Date;
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  totalItemsSold: number;
  avgTransactionValue: number;
  cashSales: number;
  mpesaSales: number;
  creditSales: number;
  cashCount: number;
  mpesaCount: number;
  creditCount: number;
  creditGiven: number;
  creditGivenCount: number;
  creditPaid: number;
  creditPaidCount: number;
  pendingCredits: number;
  voidedCount: number;
  voidedAmount: number;
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
  bestEmployees: { name: string; sales: number; transactions: number; profit: number; type: string }[];
  bestCustomer: { name: string; spent: number; transactions: number } | null;
  suppliedProducts: { supplier: string; product: string; qty: number; amount: number; status: string }[];
  totalSuppliedAmount: number;
  totalOwedToSuppliers: number;
  dailySales: { date: string; sales: number; profit: number; transactions: number }[];
  activeDays: number;
  bestDay: { date: string; sales: number } | null;
}

export default function MonthlyReportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const monthParam = searchParams.get('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return startOfMonth(new Date());
  });
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyReport(currentMonth);
  }, [currentMonth]);

  function changeMonth(delta: number) {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    if (d <= new Date()) {
      setCurrentMonth(startOfMonth(d));
    }
  }

  async function fetchMonthlyReport(month: Date) {
    setLoading(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [
        { data: salesData },
        { data: creditsGiven },
        { data: creditsPaid },
        { data: supplierProducts },
        { data: allPendingCredits },
      ] = await Promise.all([
        supabase.from('sales').select('*, sale_items(*)').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('credits').select('*').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('credits').select('*').gte('paid_at', startISO).lte('paid_at', endISO).eq('status', 'paid'),
        supabase.from('supplier_products').select('*, suppliers(name)').gte('supplied_at', startISO).lte('supplied_at', endISO),
        supabase.from('credits').select('*').eq('status', 'pending'),
      ]);

      const sales = salesData || [];
      const completed = sales.filter(s => s.status !== 'voided');
      const voided = sales.filter(s => s.status === 'voided');

      let totalItemsSold = 0;
      completed.forEach(s => {
        (s.sale_items || []).forEach((item: any) => { totalItemsSold += item.quantity; });
      });

      const totalSales = completed.reduce((s, r) => s + Number(r.total), 0);
      const totalProfit = completed.reduce((s, r) => s + Number(r.profit), 0);

      const cashSales = completed.filter(s => s.payment_method === 'cash').reduce((s, r) => s + Number(r.total), 0);
      const mpesaSales = completed.filter(s => s.payment_method === 'mpesa').reduce((s, r) => s + Number(r.total), 0);
      const creditSalesAmt = completed.filter(s => s.payment_method === 'credit').reduce((s, r) => s + Number(r.total), 0);

      const creditGiven = (creditsGiven || []).reduce((s, c) => s + Number(c.total_owed), 0);
      const creditPaid = (creditsPaid || []).reduce((s, c) => s + Number(c.total_owed), 0);
      const pendingCredits = (allPendingCredits || []).reduce((s, c) => s + Number(c.balance), 0);

      // Top products
      const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
      completed.forEach(s => {
        (s.sale_items || []).forEach((item: any) => {
          const ex = productMap.get(item.product_name) || { name: item.product_name, qty: 0, revenue: 0, profit: 0 };
          ex.qty += item.quantity;
          ex.revenue += Number(item.total);
          ex.profit += Number(item.profit);
          productMap.set(item.product_name, ex);
        });
      });
      const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

      // Best employees
      const cashierIds = [...new Set(completed.map(s => s.cashier_id))];
      let profilesMap = new Map<string, string>();
      if (cashierIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', cashierIds);
        profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      }

      const empMap = new Map<string, { name: string; sales: number; transactions: number; profit: number; type: string }>();
      completed.forEach(sale => {
        const key = sale.sold_on_behalf_of || sale.cashier_id;
        const name = sale.sold_on_behalf_name || profilesMap.get(sale.cashier_id) || 'Unknown';
        const type = sale.sold_on_behalf_of ? 'Casual' : 'Staff';
        const ex = empMap.get(key) || { name, sales: 0, transactions: 0, profit: 0, type };
        ex.sales += Number(sale.total);
        ex.transactions += 1;
        ex.profit += Number(sale.profit);
        empMap.set(key, ex);
      });
      const bestEmployees = Array.from(empMap.values()).sort((a, b) => b.sales - a.sales);

      // Best customer
      const custMap = new Map<string, { name: string; spent: number; transactions: number }>();
      completed.filter(s => s.customer_name).forEach(s => {
        const name = s.customer_name!;
        const ex = custMap.get(name) || { name, spent: 0, transactions: 0 };
        ex.spent += Number(s.total);
        ex.transactions += 1;
        custMap.set(name, ex);
      });
      const bestCustomer = Array.from(custMap.values()).sort((a, b) => b.spent - a.spent)[0] || null;

      // Supplier data
      const suppliedProductsList = (supplierProducts || []).map((sp: any) => ({
        supplier: sp.suppliers?.name || 'Unknown',
        product: sp.product_name,
        qty: sp.quantity,
        amount: Number(sp.total_amount),
        status: sp.payment_status,
      }));
      const totalSuppliedAmount = suppliedProductsList.reduce((s: number, p: any) => s + p.amount, 0);
      const totalOwedToSuppliers = suppliedProductsList.filter((p: any) => p.status === 'unpaid').reduce((s: number, p: any) => s + p.amount, 0);

      // Daily breakdown
      const dailyMap = new Map<string, { sales: number; profit: number; transactions: number }>();
      const days = eachDayOfInterval({ start, end: end > new Date() ? new Date() : end });
      days.forEach(d => dailyMap.set(format(d, 'yyyy-MM-dd'), { sales: 0, profit: 0, transactions: 0 }));
      completed.forEach(s => {
        const day = format(new Date(s.created_at), 'yyyy-MM-dd');
        const ex = dailyMap.get(day) || { sales: 0, profit: 0, transactions: 0 };
        ex.sales += Number(s.total);
        ex.profit += Number(s.profit);
        ex.transactions += 1;
        dailyMap.set(day, ex);
      });
      const dailySales = Array.from(dailyMap.entries())
        .map(([date, d]) => ({ date, ...d }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const activeDays = dailySales.filter(d => d.transactions > 0).length;
      const bestDay = dailySales.length > 0
        ? dailySales.reduce((best, d) => d.sales > best.sales ? d : best, dailySales[0])
        : null;

      setReport({
        month,
        totalSales, totalProfit, totalTransactions: completed.length, totalItemsSold,
        avgTransactionValue: completed.length > 0 ? totalSales / completed.length : 0,
        cashSales, mpesaSales, creditSales: creditSalesAmt,
        cashCount: completed.filter(s => s.payment_method === 'cash').length,
        mpesaCount: completed.filter(s => s.payment_method === 'mpesa').length,
        creditCount: completed.filter(s => s.payment_method === 'credit').length,
        creditGiven, creditGivenCount: (creditsGiven || []).length,
        creditPaid, creditPaidCount: (creditsPaid || []).length,
        pendingCredits,
        voidedCount: voided.length,
        voidedAmount: voided.reduce((s, r) => s + Number(r.total), 0),
        topProducts, bestEmployees, bestCustomer,
        suppliedProducts: suppliedProductsList, totalSuppliedAmount, totalOwedToSuppliers,
        dailySales, activeDays,
        bestDay: bestDay && bestDay.sales > 0 ? { date: bestDay.date, sales: bestDay.sales } : null,
      });
    } catch (err) {
      console.error('Failed to fetch monthly report:', err);
    } finally {
      setLoading(false);
    }
  }

  function generateReportHTML() {
    if (!report) return '';
    const r = report;
    const monthStr = format(r.month, 'MMMM yyyy');

    const productRows = r.topProducts.map(p => `
      <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${p.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${p.qty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.revenue)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.profit)}</td></tr>
    `).join('');

    const empRows = r.bestEmployees.map((e, i) => `
      <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i === 0 ? '🏆 ' : ''}${e.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${e.type}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${e.transactions}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(e.sales)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(e.profit)}</td></tr>
    `).join('');

    const supplyRows = r.suppliedProducts.map(s => `
      <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${s.supplier}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${s.product}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${s.qty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(s.amount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${s.status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}</td></tr>
    `).join('');

    const dailyRows = r.dailySales.filter(d => d.transactions > 0).map(d => `
      <tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${format(new Date(d.date), 'EEE, MMM d')}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${d.transactions}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(d.sales)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(d.profit)}</td></tr>
    `).join('');

    return `<html><head><title>Monthly Report - ${monthStr}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#333;max-width:900px;margin:0 auto}
      h1{margin:0;font-size:22px} h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
      th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
      .stat{background:#f9f9f9;padding:12px;border-radius:8px;text-align:center}
      .stat-label{font-size:11px;color:#666;text-transform:uppercase}
      .stat-value{font-size:20px;font-weight:bold;margin-top:4px}
      .green{color:#16a34a} .red{color:#dc2626} .blue{color:#2563eb}
      @media print{body{padding:0}.no-print{display:none}}
    </style></head><body>
      <div style="border-bottom:3px solid #333;padding-bottom:12px;margin-bottom:16px">
        <h1>📊 Monthly Business Report</h1>
        <p style="margin:4px 0;color:#666">${monthStr}</p>
        <p style="margin:2px 0;font-size:12px;color:#999">Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
      </div>

      <h2>💰 Sales Summary</h2>
      <div class="grid">
        <div class="stat"><div class="stat-label">Total Sales</div><div class="stat-value">${formatCurrency(r.totalSales)}</div></div>
        <div class="stat"><div class="stat-label">Profit</div><div class="stat-value green">${formatCurrency(r.totalProfit)}</div></div>
        <div class="stat"><div class="stat-label">Transactions</div><div class="stat-value">${r.totalTransactions}</div></div>
        <div class="stat"><div class="stat-label">Items Sold</div><div class="stat-value">${r.totalItemsSold}</div></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="stat-label">Active Days</div><div class="stat-value">${r.activeDays}</div></div>
        <div class="stat"><div class="stat-label">Avg/Day</div><div class="stat-value">${formatCurrency(r.activeDays > 0 ? r.totalSales / r.activeDays : 0)}</div></div>
        <div class="stat"><div class="stat-label">Best Day</div><div class="stat-value">${r.bestDay ? format(new Date(r.bestDay.date), 'MMM d') : 'N/A'}</div>
          ${r.bestDay ? `<div style="font-size:11px;color:#666">${formatCurrency(r.bestDay.sales)}</div>` : ''}</div>
      </div>

      <h2>💳 Payment Breakdown</h2>
      <div class="grid">
        <div class="stat"><div class="stat-label">Cash</div><div class="stat-value">${formatCurrency(r.cashSales)}</div><div style="font-size:11px;color:#666">${r.cashCount} transactions</div></div>
        <div class="stat"><div class="stat-label">M-Pesa</div><div class="stat-value blue">${formatCurrency(r.mpesaSales)}</div><div style="font-size:11px;color:#666">${r.mpesaCount} transactions</div></div>
        <div class="stat"><div class="stat-label">Credit</div><div class="stat-value red">${formatCurrency(r.creditSales)}</div><div style="font-size:11px;color:#666">${r.creditCount} transactions</div></div>
        <div class="stat"><div class="stat-label">Avg Transaction</div><div class="stat-value">${formatCurrency(r.avgTransactionValue)}</div></div>
      </div>

      <h2>📋 Credit Activity</h2>
      <div class="grid">
        <div class="stat"><div class="stat-label">Credit Given</div><div class="stat-value red">${formatCurrency(r.creditGiven)}</div><div style="font-size:11px;color:#666">${r.creditGivenCount} records</div></div>
        <div class="stat"><div class="stat-label">Credit Paid</div><div class="stat-value green">${formatCurrency(r.creditPaid)}</div><div style="font-size:11px;color:#666">${r.creditPaidCount} payments</div></div>
        <div class="stat"><div class="stat-label">Total Pending</div><div class="stat-value red">${formatCurrency(r.pendingCredits)}</div></div>
        <div class="stat"><div class="stat-label">Voided Sales</div><div class="stat-value">${r.voidedCount} (${formatCurrency(r.voidedAmount)})</div></div>
      </div>

      ${r.bestCustomer ? `<h2>⭐ Best Customer</h2><div class="stat" style="display:inline-block;padding:12px 24px"><div class="stat-label">Top Buyer</div><div class="stat-value">${r.bestCustomer.name}</div><div style="font-size:12px;color:#666">${formatCurrency(r.bestCustomer.spent)} across ${r.bestCustomer.transactions} transactions</div></div>` : ''}

      <h2>👥 Employee Performance</h2>
      <table><thead><tr><th>Name</th><th style="text-align:center">Role</th><th style="text-align:center">Transactions</th><th style="text-align:right">Sales</th><th style="text-align:right">Profit</th></tr></thead>
      <tbody>${empRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#999">No sales recorded</td></tr>'}</tbody></table>

      <h2>📦 Top Products</h2>
      <table><thead><tr><th>Product</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th><th style="text-align:right">Profit</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999">No products sold</td></tr>'}</tbody></table>

      ${r.suppliedProducts.length > 0 ? `
      <h2>🚚 Supplier Deliveries</h2>
      <div class="grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="stat"><div class="stat-label">Total Supplied</div><div class="stat-value">${formatCurrency(r.totalSuppliedAmount)}</div></div>
        <div class="stat"><div class="stat-label">Owed to Suppliers</div><div class="stat-value red">${formatCurrency(r.totalOwedToSuppliers)}</div></div>
      </div>
      <table><thead><tr><th>Supplier</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${supplyRows}</tbody></table>` : ''}

      <h2>📅 Daily Breakdown</h2>
      <table><thead><tr><th>Date</th><th style="text-align:center">Transactions</th><th style="text-align:right">Sales</th><th style="text-align:right">Profit</th></tr></thead>
      <tbody>${dailyRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999">No data</td></tr>'}</tbody></table>
    </body></html>`;
  }

  function handlePrint() { printHTML(generateReportHTML()); }
  async function handleDownload() {
    await generatePDFFromHTML(generateReportHTML(), `Monthly_Report_${format(currentMonth, 'yyyy-MM')}.pdf`);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Failed to load report</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/reports')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  const r = report;

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Monthly Report</h1>
              <div className="flex items-center gap-2 mt-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeMonth(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <p className="text-muted-foreground font-medium">{format(currentMonth, 'MMMM yyyy')}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeMonth(1)}
                  disabled={startOfMonth(new Date()).getTime() <= currentMonth.getTime()}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="w-3.5 h-3.5" /> Total Sales</div>
            <p className="text-xl font-bold mt-1">{formatCurrency(r.totalSales)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="w-3.5 h-3.5" /> Profit</div>
            <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(r.totalProfit)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShoppingCart className="w-3.5 h-3.5" /> Transactions</div>
            <p className="text-xl font-bold mt-1">{r.totalTransactions}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="w-3.5 h-3.5" /> Items Sold</div>
            <p className="text-xl font-bold mt-1">{r.totalItemsSold}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="w-3.5 h-3.5" /> Active Days</div>
            <p className="text-xl font-bold mt-1">{r.activeDays}</p>
          </CardContent></Card>
        </div>

        {/* Best Day */}
        {r.bestDay && (
          <Card className="border-primary/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Best Sales Day</p>
                <p className="font-bold text-lg">{format(new Date(r.bestDay.date), 'EEEE, MMMM d')}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(r.bestDay.sales)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Cash</p>
                <p className="font-bold text-lg">{formatCurrency(r.cashSales)}</p>
                <p className="text-xs text-muted-foreground">{r.cashCount} transactions</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">M-Pesa</p>
                <p className="font-bold text-lg text-blue-600">{formatCurrency(r.mpesaSales)}</p>
                <p className="text-xs text-muted-foreground">{r.mpesaCount} transactions</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Credit</p>
                <p className="font-bold text-lg text-destructive">{formatCurrency(r.creditSales)}</p>
                <p className="text-xs text-muted-foreground">{r.creditCount} transactions</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Avg Transaction</p>
                <p className="font-bold text-lg">{formatCurrency(r.avgTransactionValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Activity */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Credit Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-destructive/5">
                <p className="text-xs text-muted-foreground">Credit Given</p>
                <p className="font-bold text-lg text-destructive">{formatCurrency(r.creditGiven)}</p>
                <p className="text-xs text-muted-foreground">{r.creditGivenCount} records</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-xs text-muted-foreground">Credit Paid</p>
                <p className="font-bold text-lg text-green-600">{formatCurrency(r.creditPaid)}</p>
                <p className="text-xs text-muted-foreground">{r.creditPaidCount} payments</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/5">
                <p className="text-xs text-muted-foreground">Total Pending</p>
                <p className="font-bold text-lg text-destructive">{formatCurrency(r.pendingCredits)}</p>
              </div>
              {r.voidedCount > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Voided</p>
                  <p className="font-bold text-lg">{r.voidedCount} sales</p>
                  <p className="text-xs text-destructive">{formatCurrency(r.voidedAmount)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Best Customer & Employee */}
        <div className="grid lg:grid-cols-2 gap-3">
          {r.bestCustomer && (
            <Card className="border-yellow-300/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best Customer This Month</p>
                  <p className="font-bold text-lg">{r.bestCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(r.bestCustomer.spent)} • {r.bestCustomer.transactions} transactions</p>
                </div>
              </CardContent>
            </Card>
          )}
          {r.bestEmployees.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best Seller This Month</p>
                  <p className="font-bold text-lg">{r.bestEmployees[0].name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(r.bestEmployees[0].sales)} • {r.bestEmployees[0].transactions} transactions</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Employee Performance */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Employee Performance</CardTitle></CardHeader>
          <CardContent>
            {r.bestEmployees.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No sales recorded</p>
            ) : (
              <div className="space-y-2">
                {r.bestEmployees.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {emp.name}
                          <Badge variant="secondary" className="text-[10px]">{emp.type}</Badge>
                          {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.transactions} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(emp.sales)}</p>
                      <p className="text-xs text-green-600">{formatCurrency(emp.profit)} profit</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Top Products</CardTitle></CardHeader>
          <CardContent>
            {r.topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No products sold</p>
            ) : (
              <div className="space-y-2">
                {r.topProducts.map((prod, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                      <div>
                        <p className="font-medium">{prod.name}</p>
                        <p className="text-xs text-muted-foreground">{prod.qty} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(prod.revenue)}</p>
                      <p className="text-xs text-green-600">{formatCurrency(prod.profit)} profit</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Deliveries */}
        {r.suppliedProducts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4" /> Supplier Deliveries</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Supplied</p>
                  <p className="font-bold text-lg">{formatCurrency(r.totalSuppliedAmount)}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5">
                  <p className="text-xs text-muted-foreground">Owed to Suppliers</p>
                  <p className="font-bold text-lg text-destructive">{formatCurrency(r.totalOwedToSuppliers)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {r.suppliedProducts.map((sp, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">{sp.product}</p>
                      <p className="text-xs text-muted-foreground">{sp.supplier} • Qty: {sp.qty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{formatCurrency(sp.amount)}</p>
                      <Badge variant={sp.status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">
                        {sp.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Daily Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {r.dailySales.filter(d => d.transactions > 0).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No daily data</p>
              ) : (
                r.dailySales.filter(d => d.transactions > 0).map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border text-sm hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/reports/full?date=${d.date}`)}>
                    <div>
                      <p className="font-medium">{format(new Date(d.date), 'EEE, MMM d')}</p>
                      <p className="text-xs text-muted-foreground">{d.transactions} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(d.sales)}</p>
                      <p className="text-xs text-green-600">{formatCurrency(d.profit)} profit</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

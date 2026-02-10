import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { useSettings } from '@/hooks/useSettings';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, Phone, MapPin, Building2, Printer, Download,
  Receipt, RotateCcw, CheckCircle2, Clock, UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Customer, Sale } from '@/types/database';

interface CreditInfo {
  id: string;
  status: string;
  total_owed: number;
  amount_paid: number;
  balance: number;
}

interface SaleWithCredit extends Sale {
  credit?: CreditInfo | null;
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { receiptSettings } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<SaleWithCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleWithCredit | null>(null);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const [customerRes, salesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id!).maybeSingle(),
        supabase
          .from('sales')
          .select('*, sale_items(*), credits(*)')
          .eq('customer_id', id!)
          .order('created_at', { ascending: false }),
      ]);

      if (customerRes.error) throw customerRes.error;
      if (salesRes.error) throw salesRes.error;

      setCustomer(customerRes.data as Customer);

      // credits is one-to-one, so it comes as object or null
      const salesWithCredit = (salesRes.data || []).map((s: any) => ({
        ...s,
        credit: s.credits || null,
      }));
      setSales(salesWithCredit as SaleWithCredit[]);
    } catch {
      setCustomer(null);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }

  // Summary calculations
  const totalSpent = sales.reduce((s, r) => s + Number(r.total), 0);
  const totalTransactions = sales.length;
  const pendingCredits = sales.filter(s => s.credit?.status === 'pending');
  const totalPendingBalance = pendingCredits.reduce((s, r) => s + Number(r.credit?.balance || 0), 0);
  const returnedSales = sales.filter(s => s.credit?.status === 'returned' || s.status === 'voided');
  const paidCredits = sales.filter(s => s.credit?.status === 'paid');

  function getCreditBadge(sale: SaleWithCredit) {
    if (!sale.credit) {
      if (sale.status === 'voided') return <Badge variant="outline" className="text-xs">Voided</Badge>;
      return <Badge variant="default" className="text-xs bg-success/10 text-success border-success/20">Completed</Badge>;
    }
    switch (sale.credit.status) {
      case 'paid':
        return <Badge variant="default" className="text-xs bg-success/10 text-success border-success/20">Credit Paid</Badge>;
      case 'returned':
        return <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">Returned</Badge>;
      default:
        return <Badge variant="destructive" className="text-xs">Pending</Badge>;
    }
  }

  function generateReportHTML() {
    if (!customer) return '';
    const companyName = receiptSettings?.company_name || 'Ruinu General Merchants';

    const rows = sales.map(s => {
      const creditStatus = s.credit ? s.credit.status : (s.status === 'voided' ? 'voided' : 'completed');
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.receipt_number}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;">${s.payment_method}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.total)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;">${creditStatus}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(s.sale_items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Customer Report - ${customer.name}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
      .company { font-size: 16px; font-weight: bold; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
      .info-item { font-size: 11px; }
      .info-label { color: #666; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0; }
      .summary-card { background: #f9f9f9; padding: 10px; border-radius: 6px; text-align: center; }
      .summary-value { font-size: 16px; font-weight: bold; }
      .summary-label { font-size: 10px; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f0f0f0; padding: 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #ccc; }
      .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="header">
      <div class="company">${companyName}</div>
      <h1>Customer Transaction Report</h1>
      <p>Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
    </div>

    <h2>Customer Details</h2>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Name:</span> <strong>${customer.name}</strong></div>
      ${customer.phone ? `<div class="info-item"><span class="info-label">Phone:</span> ${customer.phone}</div>` : ''}
      ${customer.business_name ? `<div class="info-item"><span class="info-label">Business:</span> ${customer.business_name}</div>` : ''}
      ${customer.location ? `<div class="info-item"><span class="info-label">Location:</span> ${customer.location}</div>` : ''}
      <div class="info-item"><span class="info-label">Category:</span> ${customer.category || 'retail'}</div>
      <div class="info-item"><span class="info-label">Since:</span> ${format(new Date(customer.created_at), 'dd MMM yyyy')}</div>
    </div>

    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="summary-value">${totalTransactions}</div><div class="summary-label">Total Transactions</div></div>
      <div class="summary-card"><div class="summary-value">${formatCurrency(totalSpent)}</div><div class="summary-label">Total Spent</div></div>
      <div class="summary-card"><div class="summary-value">${pendingCredits.length}</div><div class="summary-label">Pending Credits</div></div>
      <div class="summary-card"><div class="summary-value">${formatCurrency(totalPendingBalance)}</div><div class="summary-label">Outstanding Balance</div></div>
    </div>

    <h2>All Transactions</h2>
    <table>
      <thead><tr><th>Receipt #</th><th>Date</th><th>Payment</th><th style="text-align:right;">Amount</th><th>Status</th><th>Items</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      <p>${companyName} • ${receiptSettings?.phone || ''} • ${receiptSettings?.address || ''}</p>
    </div>
    </body></html>`;
  }

  function handlePrint() {
    const html = generateReportHTML();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;left:-9999px';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }

  function handleDownload() {
    const html = generateReportHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-report-${customer?.name?.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground mb-4">Customer not found</p>
          <Button onClick={() => navigate('/customers')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">{customer.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>}
                {customer.business_name && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {customer.business_name}</span>}
                {customer.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {customer.location}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print Report
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalTransactions}</p>
              <p className="text-xs text-muted-foreground">Total Transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold currency">{formatCurrency(totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Total Spent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{pendingCredits.length}</p>
              <p className="text-xs text-muted-foreground">Pending Credits</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive currency">{formatCurrency(totalPendingBalance)}</p>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No transactions recorded</p>
              </div>
            ) : (
              <div className="divide-y">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {sale.credit?.status === 'returned' || sale.status === 'voided' ? (
                            <RotateCcw className="w-4 h-4 text-warning" />
                          ) : sale.credit?.status === 'paid' ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : sale.credit?.status === 'pending' ? (
                            <Clock className="w-4 h-4 text-destructive" />
                          ) : (
                            <Receipt className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-medium text-sm">#{sale.receipt_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.created_at), 'dd MMM yyyy • HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold currency text-sm">{formatCurrency(sale.total)}</p>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <Badge variant="outline" className="text-2xs capitalize">{sale.payment_method}</Badge>
                            {getCreditBadge(sale)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Show items preview */}
                    {sale.sale_items && sale.sale_items.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 ml-12 truncate">
                        {sale.sale_items.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt #{selectedSale?.receipt_number}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{format(new Date(selectedSale.created_at), 'dd MMM yyyy HH:mm')}</span>
                <div className="flex gap-1">
                  <Badge variant="outline" className="capitalize">{selectedSale.payment_method}</Badge>
                  {getCreditBadge(selectedSale)}
                </div>
              </div>

              {/* Credit details if applicable */}
              {selectedSale.credit && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium">Credit Details</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Owed:</span> <span className="font-medium">{formatCurrency(selectedSale.credit.total_owed)}</span></div>
                    <div><span className="text-muted-foreground">Paid:</span> <span className="font-medium text-success">{formatCurrency(selectedSale.credit.amount_paid)}</span></div>
                    <div><span className="text-muted-foreground">Balance:</span> <span className="font-medium text-destructive">{formatCurrency(selectedSale.credit.balance)}</span></div>
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-medium">Product</th>
                      <th className="text-center p-2 font-medium">Qty</th>
                      <th className="text-right p-2 font-medium">Price</th>
                      <th className="text-right p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSale as any).sale_items?.map((item: any) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.product_name}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-3">
                <span>Total</span>
                <span>{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format, differenceInDays } from 'date-fns';
import { generatePDFFromHTML, printHTML } from '@/lib/pdfUtils';
import {
  ArrowLeft, Printer, Download, Loader2, Phone, Mail, Package,
  Clock, AlertTriangle, CheckCircle, DollarSign, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupplierPayments, useReturnsDamages } from '@/hooks/useSupplierTracking';
import type { Supplier, SupplierProduct } from '@/types/database';

export default function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const { payments, loading: paymentsLoading } = useSupplierPayments(id);
  const { returns, loading: returnsLoading } = useReturnsDamages(id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*, supplier_products(*)')
        .eq('id', id)
        .single();
      if (!error && data) setSupplier(data as unknown as Supplier);
      setLoading(false);
    })();
  }, [id]);

  function getPaymentStatus(product: SupplierProduct) {
    if (product.payment_status === 'paid') return { label: 'Paid', color: 'bg-success/10 text-success', icon: CheckCircle };
    if ((product as any).payment_status === 'partially_paid') return { label: 'Partial', color: 'bg-primary/10 text-primary', icon: DollarSign };
    if (!product.due_date) return { label: 'Unpaid', color: 'bg-warning/10 text-warning', icon: Clock };
    const days = differenceInDays(new Date(product.due_date), new Date());
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'bg-destructive/10 text-destructive', icon: AlertTriangle };
    return { label: `${days}d remaining`, color: 'bg-warning/10 text-warning', icon: Clock };
  }

  function generateReportHTML() {
    if (!supplier) return '';
    const products = supplier.supplier_products || [];
    const totalSupplied = products.reduce((s, p) => s + p.total_amount, 0);
    const totalPaidAmt = payments.reduce((s, p) => s + p.amount, 0);
    const totalReturns = returns.reduce((s, r) => s + r.quantity, 0);
    const totalBalance = totalSupplied - totalPaidAmt;

    const rows = products
      .sort((a, b) => new Date(b.supplied_at).getTime() - new Date(a.supplied_at).getTime())
      .map(p => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${format(new Date(p.supplied_at), 'dd MMM yyyy')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${p.product_name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.buying_price)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.total_amount)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.payment_status === 'paid' ? 'Paid' : (p as any).payment_status === 'partially_paid' ? 'Partial' : 'Unpaid'}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${(p as any).grn_number || '-'}</td>
        </tr>
      `).join('');

    const paymentRows = payments.map(p => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${format(new Date(p.payment_date), 'dd MMM yyyy')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${p.payment_method}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.amount)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${p.notes || '-'}</td>
      </tr>
    `).join('');

    return `
      <html><head><title>Supplier Ledger - ${supplier.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f5f5f5;padding:10px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:13px}
      td{font-size:13px}
      .header{border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:16px}
      .summary{display:flex;gap:24px;margin-bottom:20px}
      .stat{background:#f9f9f9;padding:12px 16px;border-radius:8px;flex:1}
      .stat-label{font-size:12px;color:#666}
      .stat-value{font-size:18px;font-weight:bold;margin-top:4px}
      h2{margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:8px}
      @media print{body{padding:0}}</style></head>
      <body>
        <div class="header">
          <h1 style="margin:0">${supplier.name} - Supplier Ledger</h1>
          <p style="margin:4px 0;color:#666">Generated ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          ${supplier.phone ? `<p style="margin:2px 0;font-size:14px">Phone: ${supplier.phone}</p>` : ''}
          ${supplier.email ? `<p style="margin:2px 0;font-size:14px">Email: ${supplier.email}</p>` : ''}
          <p style="margin:2px 0;font-size:14px">Payment Terms: ${supplier.payment_terms} days</p>
        </div>
        <div class="summary">
          <div class="stat"><div class="stat-label">Total Supplied</div><div class="stat-value">${formatCurrency(totalSupplied)}</div></div>
          <div class="stat"><div class="stat-label">Total Paid</div><div class="stat-value" style="color:green">${formatCurrency(totalPaidAmt)}</div></div>
          <div class="stat"><div class="stat-label">Balance</div><div class="stat-value" style="color:red">${formatCurrency(Math.max(0, totalBalance))}</div></div>
          <div class="stat"><div class="stat-label">Returns</div><div class="stat-value">${totalReturns} items</div></div>
        </div>
        <h2>Supply Records</h2>
        <table>
          <thead><tr><th>Date</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th><th style="text-align:center">Status</th><th>GRN</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999">No supply records</td></tr>'}</tbody>
        </table>
        ${payments.length > 0 ? `
          <h2>Payment History</h2>
          <table>
            <thead><tr><th>Date</th><th>Method</th><th style="text-align:right">Amount</th><th>Notes</th></tr></thead>
            <tbody>${paymentRows}</tbody>
          </table>
        ` : ''}
      </body></html>`;
  }

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!supplier) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Supplier not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/suppliers')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </div>
      </AppLayout>
    );
  }

  const products = (supplier.supplier_products || []).sort(
    (a, b) => new Date(b.supplied_at).getTime() - new Date(a.supplied_at).getTime()
  );
  const totalSupplied = products.reduce((s, p) => s + p.total_amount, 0);
  const totalPaidFromPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaidFromRecords = products.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.total_amount, 0);
  const totalPaid = Math.max(totalPaidFromPayments, totalPaidFromRecords);
  const totalBalance = Math.max(0, totalSupplied - totalPaid);
  const totalReturnQty = returns.reduce((s, r) => s + r.quantity, 0);

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers')}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">{supplier.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                {supplier.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {supplier.phone}</span>}
                {supplier.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {supplier.email}</span>}
                <Badge variant="secondary">{supplier.payment_terms}d terms</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => printHTML(generateReportHTML())}><Printer className="w-4 h-4 mr-2" /> Print</Button>
            <Button variant="outline" onClick={() => generatePDFFromHTML(generateReportHTML(), `Supplier_${supplier.name?.replace(/\s+/g, '_')}_Ledger.pdf`)}><Download className="w-4 h-4 mr-2" /> Download</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Supplied</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalSupplied)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-xl font-bold mt-1 text-success">{formatCurrency(totalPaid)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(totalBalance)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Supply Records</p>
            <p className="text-xl font-bold mt-1">{products.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Returns</p>
            <p className="text-xl font-bold mt-1">{totalReturnQty} items</p>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="supplies">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="supplies">Supplies ({products.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            <TabsTrigger value="returns">Returns ({returns.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="supplies" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Supply Records</CardTitle></CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No supply records yet</p>
                ) : (
                  <div className="space-y-2">
                    {products.map((product) => {
                      const status = getPaymentStatus(product);
                      const StatusIcon = status.icon;
                      return (
                        <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{product.product_name}</p>
                              {(product as any).grn_number && <Badge variant="outline" className="text-xs">{(product as any).grn_number}</Badge>}
                              {(product as any).batch_reference && <Badge variant="outline" className="text-xs">Batch: {(product as any).batch_reference}</Badge>}
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>{format(new Date(product.supplied_at), 'dd MMM yyyy')}</span>
                              <span>Qty: {product.quantity}</span>
                              <span>@ {formatCurrency(product.buying_price)}</span>
                              <span className="font-semibold text-foreground">{formatCurrency(product.total_amount)}</span>
                              {(product as any).amount_paid > 0 && product.payment_status !== 'paid' && (
                                <span className="text-primary">Paid: {formatCurrency((product as any).amount_paid)}</span>
                              )}
                            </div>
                            {product.notes && <p className="text-xs text-muted-foreground mt-1">{product.notes}</p>}
                          </div>
                          <Badge variant="secondary" className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />{status.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> Payment History</CardTitle></CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No payments recorded</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div>
                          <p className="font-medium">{format(new Date(p.payment_date), 'dd MMM yyyy')}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <Badge variant="secondary">{p.payment_method}</Badge>
                            {p.notes && <span>{p.notes}</span>}
                          </div>
                        </div>
                        <p className="text-lg font-bold text-success">{formatCurrency(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Returns & Damages</CardTitle></CardHeader>
              <CardContent>
                {returnsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : returns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No returns or damages recorded</p>
                ) : (
                  <div className="space-y-2">
                    {returns.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{r.product_name}</p>
                            <Badge variant={r.type === 'damaged' ? 'destructive' : 'secondary'}>{r.type}</Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span>{format(new Date(r.date_returned), 'dd MMM yyyy')}</span>
                            <span>Qty: {r.quantity}</span>
                            {r.reason && <span>{r.reason}</span>}
                            {r.stock_adjusted && <Badge variant="outline" className="text-xs">Stock adjusted</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

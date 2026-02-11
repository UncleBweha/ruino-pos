import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format, differenceInDays } from 'date-fns';
import { generatePDFFromHTML, printHTML } from '@/lib/pdfUtils';
import {
  ArrowLeft, Printer, Download, Loader2, Phone, Mail, Package,
  Clock, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Supplier, SupplierProduct } from '@/types/database';

export default function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (product.payment_status === 'paid') return { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle };
    if (!product.due_date) return { label: 'Unpaid', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
    const days = differenceInDays(new Date(product.due_date), new Date());
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'bg-red-100 text-red-700', icon: AlertTriangle };
    return { label: `${days}d remaining`, color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  }

  function generateReportHTML() {
    if (!supplier) return '';
    const products = supplier.supplier_products || [];
    const totalSupplied = products.reduce((s, p) => s + p.total_amount, 0);
    const totalPaid = products.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.total_amount, 0);
    const totalUnpaid = totalSupplied - totalPaid;

    const rows = products
      .sort((a, b) => new Date(b.supplied_at).getTime() - new Date(a.supplied_at).getTime())
      .map(p => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${format(new Date(p.supplied_at), 'dd MMM yyyy')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${p.product_name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.buying_price)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(p.total_amount)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.payment_status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}</td>
        </tr>
      `).join('');

    return `
      <html><head><title>Supplier Report - ${supplier.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f5f5f5;padding:10px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:13px}
      td{font-size:13px}
      .header{border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:16px}
      .summary{display:flex;gap:24px;margin-bottom:20px}
      .stat{background:#f9f9f9;padding:12px 16px;border-radius:8px;flex:1}
      .stat-label{font-size:12px;color:#666}
      .stat-value{font-size:18px;font-weight:bold;margin-top:4px}
      @media print{body{padding:0}.no-print{display:none}}</style></head>
      <body>
        <div class="header">
          <h1 style="margin:0">${supplier.name}</h1>
          <p style="margin:4px 0;color:#666">Supplier Report • Generated ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          ${supplier.phone ? `<p style="margin:2px 0;font-size:14px">📞 ${supplier.phone}</p>` : ''}
          ${supplier.email ? `<p style="margin:2px 0;font-size:14px">✉️ ${supplier.email}</p>` : ''}
          <p style="margin:2px 0;font-size:14px">Payment Terms: ${supplier.payment_terms} days</p>
        </div>
        <div class="summary">
          <div class="stat"><div class="stat-label">Total Supplied</div><div class="stat-value">${formatCurrency(totalSupplied)}</div></div>
          <div class="stat"><div class="stat-label">Paid</div><div class="stat-value" style="color:green">${formatCurrency(totalPaid)}</div></div>
          <div class="stat"><div class="stat-label">Unpaid</div><div class="stat-value" style="color:red">${formatCurrency(totalUnpaid)}</div></div>
          <div class="stat"><div class="stat-label">Records</div><div class="stat-value">${products.length}</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th><th style="text-align:center">Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#999">No supply records</td></tr>'}</tbody>
        </table>
      </body></html>`;
  }

  function handlePrint() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(generateReportHTML());
    w.document.close();
    w.onload = () => { w.print(); };
  }

  function handleDownload() {
    const blob = new Blob([generateReportHTML()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Supplier_${supplier?.name?.replace(/\s+/g, '_')}_Report.html`;
    a.click();
    URL.revokeObjectURL(url);
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

  if (!supplier) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Supplier not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/suppliers')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Suppliers
          </Button>
        </div>
      </AppLayout>
    );
  }

  const products = (supplier.supplier_products || []).sort(
    (a, b) => new Date(b.supplied_at).getTime() - new Date(a.supplied_at).getTime()
  );
  const totalSupplied = products.reduce((s, p) => s + p.total_amount, 0);
  const totalPaid = products.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.total_amount, 0);
  const totalUnpaid = totalSupplied - totalPaid;

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
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
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Supplied</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalSupplied)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalPaid)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(totalUnpaid)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Supply Records</p>
            <p className="text-xl font-bold mt-1">{products.length}</p>
          </CardContent></Card>
        </div>

        {/* Supply Records */}
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
                        <p className="font-medium">{product.product_name}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>{format(new Date(product.supplied_at), 'dd MMM yyyy')}</span>
                          <span>Qty: {product.quantity}</span>
                          <span>@ {formatCurrency(product.buying_price)}</span>
                          <span className="font-semibold text-foreground">{formatCurrency(product.total_amount)}</span>
                        </div>
                        {product.notes && <p className="text-xs text-muted-foreground mt-1">{product.notes}</p>}
                      </div>
                      <Badge variant="secondary" className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

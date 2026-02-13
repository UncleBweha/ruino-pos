import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInvoices } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import {
  Plus, Loader2, FileText, Trash2, Download, Printer,
  ArrowRightLeft, Search, Eye, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Invoice } from '@/types/database';

interface InvoiceItemForm {
  product_name: string;
  description: string;
  quantity: string;
  unit_price: string;
}

export default function InvoicesPage() {
  const { invoices, loading, createInvoice, updateInvoiceStatus, convertToInvoice, deleteInvoice } = useInvoices();
  const { customers } = useCustomers();
  const { receiptSettings } = useSettings();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [form, setForm] = useState({
    type: 'invoice' as 'invoice' | 'quotation',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    customer_id: '',
    tax_rate: '0',
    payment_terms: '',
    notes: '',
  });
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { product_name: '', description: '', quantity: '1', unit_price: '0' },
  ]);
  const [saving, setSaving] = useState(false);

  const invoicesList = invoices.filter(i => i.type === 'invoice');
  const quotationsList = invoices.filter(i => i.type === 'quotation');

  const filteredInvoices = searchQuery
    ? invoicesList.filter(i => i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || i.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : invoicesList;
  const filteredQuotations = searchQuery
    ? quotationsList.filter(i => i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || i.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : quotationsList;

  function openForm(type: 'invoice' | 'quotation') {
    setForm({ type, customer_name: '', customer_phone: '', customer_address: '', customer_id: '', tax_rate: '0', payment_terms: '', notes: '' });
    setItems([{ product_name: '', description: '', quantity: '1', unit_price: '0' }]);
    setLogoFile(null);
    setLogoPreview(null);
    setShowForm(true);
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be under 2MB', variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return null;
    setLogoUploading(true);
    try {
      const ext = logoFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('invoice-logos').upload(fileName, logoFile);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('invoice-logos').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err) {
      toast({ title: 'Logo upload failed', variant: 'destructive' });
      return null;
    } finally {
      setLogoUploading(false);
    }
  }

  function addItemRow() {
    setItems([...items, { product_name: '', description: '', quantity: '1', unit_price: '0' }]);
  }

  function removeItemRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof InvoiceItemForm, value: string) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setForm({
        ...form,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone || '',
        customer_address: customer.location || '',
      });
    }
  }

  const calcSubtotal = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
  const calcTax = calcSubtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const calcTotal = calcSubtotal + calcTax;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (items.some(i => !i.product_name.trim())) {
      toast({ title: 'Error', description: 'All items need a product name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const logoUrl = await uploadLogo();
      await createInvoice({
        type: form.type,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        customer_address: form.customer_address || undefined,
        customer_id: form.customer_id || undefined,
        items: items.map(i => ({
          product_name: i.product_name,
          description: i.description || undefined,
          quantity: parseInt(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
        })),
        tax_rate: parseFloat(form.tax_rate) || 0,
        payment_terms: form.payment_terms || undefined,
        notes: form.notes || undefined,
        logo_url: logoUrl || undefined,
      });
      toast({ title: `${form.type === 'invoice' ? 'Invoice' : 'Quotation'} Created` });
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(id: string) {
    try {
      await convertToInvoice(id);
      toast({ title: 'Converted', description: 'Quotation converted to invoice' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  }


  function generateInvoiceHTML(invoice: Invoice): string {
    const companyName = receiptSettings?.company_name || 'Ruinu General Merchants';
    const phone = receiptSettings?.phone || '';
    const email = receiptSettings?.email || '';
    const address = receiptSettings?.address || '';
    const taxPin = receiptSettings?.tax_pin || '';
    const logoUrl = invoice.logo_url || receiptSettings?.logo_url || '';
    const items = invoice.invoice_items || [];

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${invoice.type === 'quotation' ? 'Quotation' : 'Invoice'} - ${invoice.invoice_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;max-width:800px;margin:0 auto;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #1a1a1a}
.company h1{font-size:28px;margin-bottom:4px}
.company p{font-size:12px;color:#666}
.doc-type{text-align:right}
.doc-type h2{font-size:24px;text-transform:uppercase;color:#1a1a1a}
.doc-type p{font-size:13px;color:#666}
.parties{display:flex;justify-content:space-between;margin-bottom:30px}
.party h3{font-size:11px;text-transform:uppercase;color:#999;letter-spacing:1px;margin-bottom:8px}
.party p{font-size:13px;margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-bottom:30px}
th{background:#f5f5f5;text-align:left;padding:10px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #ddd}
td{padding:10px;font-size:13px;border-bottom:1px solid #eee}
td:last-child,th:last-child{text-align:right}
.totals{text-align:right;margin-bottom:30px}
.totals div{display:flex;justify-content:flex-end;gap:40px;margin-bottom:6px;font-size:13px}
.totals .grand{font-size:18px;font-weight:bold;padding-top:10px;border-top:2px solid #1a1a1a}
.notes{background:#f9f9f9;padding:20px;border-radius:8px;margin-bottom:20px}
.notes h3{font-size:12px;text-transform:uppercase;color:#999;margin-bottom:8px}
.notes p{font-size:13px;color:#444}
.footer{text-align:center;font-size:11px;color:#999;padding-top:20px;border-top:1px solid #eee}
${logoUrl ? `.logo{max-height:120px;max-width:300px}` : ''}
@media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
<div class="header">
<div class="company">
${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" /><br/>` : ''}
<h1>${companyName}</h1>
${address ? `<p>${address}</p>` : ''}
${phone ? `<p>Tel: ${phone}</p>` : ''}
${email ? `<p>${email}</p>` : ''}
${taxPin ? `<p>PIN: ${taxPin}</p>` : ''}
</div>
<div class="doc-type">
<h2>${invoice.type === 'quotation' ? 'Quotation' : 'Invoice'}</h2>
<p><strong>${invoice.invoice_number}</strong></p>
<p>Date: ${format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
<p>Status: ${invoice.payment_status.toUpperCase()}</p>
</div>
</div>
<div class="parties">
<div class="party"><h3>Bill To</h3>
<p><strong>${invoice.customer_name}</strong></p>
${invoice.customer_phone ? `<p>${invoice.customer_phone}</p>` : ''}
${invoice.customer_address ? `<p>${invoice.customer_address}</p>` : ''}
</div>
${invoice.payment_terms ? `<div class="party"><h3>Payment Terms</h3><p>${invoice.payment_terms}</p></div>` : ''}
</div>
<table><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
${items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.product_name}</td><td>${item.description || '-'}</td><td>${item.quantity}</td><td>KES ${Number(item.unit_price).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td><td>KES ${Number(item.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
</tbody></table>
<div class="totals">
<div><span>Subtotal:</span><span>KES ${Number(invoice.subtotal).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span></div>
${invoice.tax_amount > 0 ? `<div><span>Tax (${invoice.tax_rate}%):</span><span>KES ${Number(invoice.tax_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span></div>` : ''}
<div class="grand"><span>Total:</span><span>KES ${Number(invoice.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span></div>
</div>
${invoice.notes ? `<div class="notes"><h3>Notes</h3><p>${invoice.notes}</p></div>` : ''}
<div class="footer"><p>Generated by ${companyName} • ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div>
</body></html>`;
  }

  function printInvoice(invoice: Invoice) {
    const html = generateInvoiceHTML(invoice);
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

  function downloadInvoice(invoice: Invoice) {
    const html = generateInvoiceHTML(invoice);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoice_number}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderInvoiceCard(invoice: Invoice) {
    const statusColor = invoice.payment_status === 'paid' ? 'bg-success/10 text-success'
      : invoice.payment_status === 'partial' ? 'bg-warning/10 text-warning'
      : 'bg-destructive/10 text-destructive';

    return (
      <Card key={invoice.id} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{invoice.invoice_number}</h3>
                <Badge variant="secondary" className={statusColor}>{invoice.payment_status}</Badge>
                {invoice.converted_from && (
                  <Badge variant="outline" className="text-xs">Converted</Badge>
                )}
              </div>
              <p className="text-sm mt-1">{invoice.customer_name}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(invoice.created_at), 'dd MMM yyyy')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg currency">{formatCurrency(invoice.total)}</p>
              <p className="text-xs text-muted-foreground">{(invoice.invoice_items || []).length} items</p>
            </div>
          </div>
          <div className="flex gap-1 mt-3 flex-wrap">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setPreviewInvoice(invoice); setShowPreview(true); }}>
              <Eye className="w-3 h-3 mr-1" /> View
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => printInvoice(invoice)}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => downloadInvoice(invoice)}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            {invoice.type === 'quotation' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleConvert(invoice.id)}>
                <ArrowRightLeft className="w-3 h-3 mr-1" /> To Invoice
              </Button>
            )}
            {isAdmin && invoice.payment_status === 'unpaid' && invoice.type === 'invoice' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => updateInvoiceStatus(invoice.id, 'paid')}>
                Mark Paid
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={async () => {
                if (!confirm('Delete this document?')) return;
                try { await deleteInvoice(invoice.id); toast({ title: 'Deleted' }); } catch { toast({ title: 'Error', variant: 'destructive' }); }
              }}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Invoices & Quotations</h1>
            <p className="text-muted-foreground">{invoicesList.length} invoices, {quotationsList.length} quotations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openForm('quotation')}>
              <Plus className="w-4 h-4 mr-2" />
              Quotation
            </Button>
            <Button onClick={() => openForm('invoice')}>
              <Plus className="w-4 h-4 mr-2" />
              Invoice
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList>
              <TabsTrigger value="invoices">Invoices ({filteredInvoices.length})</TabsTrigger>
              <TabsTrigger value="quotations">Quotations ({filteredQuotations.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="invoices">
              {filteredInvoices.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No invoices</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-3">{filteredInvoices.map(renderInvoiceCard)}</div>
              )}
            </TabsContent>
            <TabsContent value="quotations">
              {filteredQuotations.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No quotations</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-3">{filteredQuotations.map(renderInvoiceCard)}</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create Invoice/Quotation Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create {form.type === 'invoice' ? 'Invoice' : 'Quotation'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Customer Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <Select value={form.customer_id} onValueChange={selectCustomer}>
                  <SelectTrigger><SelectValue placeholder="Choose existing..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItemRow}><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      {idx === 0 && <Label className="text-xs">Product</Label>}
                      <Input placeholder="Product name" value={item.product_name} onChange={(e) => updateItem(idx, 'product_name', e.target.value)} className="h-9 text-sm" required />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <Label className="text-xs">Description</Label>}
                      <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">Qty</Label>}
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="h-9 text-sm" min="1" />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">Price</Label>}
                      <Input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} className="h-9 text-sm" min="0" />
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeItemRow(idx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax, Terms, Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. Net 30" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Invoice Logo</Label>
              {logoPreview ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <img src={logoPreview} alt="Logo preview" className="h-12 max-w-[160px] object-contain rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{logoFile?.name}</p>
                    <p className="text-xs text-muted-foreground">{logoFile ? (logoFile.size / 1024).toFixed(1) + ' KB' : ''}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={removeLogo}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload logo (max 2MB)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </label>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="currency">{formatCurrency(calcSubtotal)}</span></div>
              {calcTax > 0 && <div className="flex justify-between"><span>Tax ({form.tax_rate}%)</span><span className="currency">{formatCurrency(calcTax)}</span></div>}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="currency">{formatCurrency(calcTotal)}</span></div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Create ${form.type === 'invoice' ? 'Invoice' : 'Quotation'}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {previewInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{previewInvoice.customer_name}</p>
                  {previewInvoice.customer_phone && <p>{previewInvoice.customer_phone}</p>}
                  {previewInvoice.customer_address && <p>{previewInvoice.customer_address}</p>}
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={previewInvoice.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                    {previewInvoice.payment_status}
                  </Badge>
                  <p className="mt-1">{format(new Date(previewInvoice.created_at), 'dd MMM yyyy')}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted"><th className="text-left p-2">Item</th><th className="text-center p-2">Qty</th><th className="text-right p-2">Price</th><th className="text-right p-2">Total</th></tr></thead>
                  <tbody>
                    {(previewInvoice.invoice_items || []).map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.product_name}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right currency">{formatCurrency(item.unit_price)}</td>
                        <td className="p-2 text-right currency">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-right space-y-1 text-sm">
                <p>Subtotal: <span className="currency">{formatCurrency(previewInvoice.subtotal)}</span></p>
                {previewInvoice.tax_amount > 0 && <p>Tax: <span className="currency">{formatCurrency(previewInvoice.tax_amount)}</span></p>}
                <p className="font-bold text-lg">Total: <span className="currency">{formatCurrency(previewInvoice.total)}</span></p>
              </div>

              {previewInvoice.notes && (
                <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm">{previewInvoice.notes}</p></div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => printInvoice(previewInvoice)}><Printer className="w-4 h-4 mr-2" /> Print</Button>
                <Button variant="outline" onClick={() => downloadInvoice(previewInvoice)}><Download className="w-4 h-4 mr-2" /> Download</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

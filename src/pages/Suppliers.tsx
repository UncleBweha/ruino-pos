import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { format, differenceInDays, addDays } from 'date-fns';
import {
  Search, Plus, Edit2, Trash2, Loader2, Phone, Mail, Package, Clock,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, SupplierProduct } from '@/types/database';

export default function SuppliersPage() {
  const { suppliers, loading, createSupplier, updateSupplier, deleteSupplier, addSupplyRecord, updateSupplyPayment, deleteSupplyRecord } = useSuppliers();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const [form, setForm] = useState({ name: '', phone: '', email: '', payment_terms: '30', notes: '' });
  const [supplyForm, setSupplyForm] = useState({
    product_name: '', quantity: '', buying_price: '', payment_status: 'unpaid', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const filtered = searchQuery
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : suppliers;

  function openAdd() {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', payment_terms: '30', notes: '' });
    setShowForm(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      payment_terms: supplier.payment_terms.toString(),
      notes: supplier.notes || '',
    });
    setShowForm(true);
  }

  function openSupplyForm(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setSupplyForm({ product_name: '', quantity: '', buying_price: '', payment_status: 'unpaid', notes: '' });
    setShowSupplyForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, payment_terms: parseInt(form.payment_terms) || 30 };
      if (editing) {
        await updateSupplier(editing.id, payload);
        toast({ title: 'Supplier Updated' });
      } else {
        await createSupplier(payload);
        toast({ title: 'Supplier Added' });
      }
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSupply(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const qty = parseInt(supplyForm.quantity) || 0;
      const price = parseFloat(supplyForm.buying_price) || 0;
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const dueDate = supplier
        ? addDays(new Date(), supplier.payment_terms).toISOString()
        : undefined;

      await addSupplyRecord({
        supplier_id: selectedSupplierId,
        product_name: supplyForm.product_name,
        quantity: qty,
        buying_price: price,
        total_amount: qty * price,
        payment_status: supplyForm.payment_status,
        due_date: dueDate,
        notes: supplyForm.notes || undefined,
      });
      toast({ title: 'Supply Record Added' });
      setShowSupplyForm(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`Delete ${supplier.name}? All supply records will be removed.`)) return;
    try {
      await deleteSupplier(supplier.id);
      toast({ title: 'Deleted' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  }


  function getPaymentStatus(product: SupplierProduct) {
    if (product.payment_status === 'paid') return { label: 'Paid', color: 'bg-success/10 text-success', icon: CheckCircle };
    if (!product.due_date) return { label: 'Unpaid', color: 'bg-warning/10 text-warning', icon: Clock };
    const days = differenceInDays(new Date(product.due_date), new Date());
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'bg-destructive/10 text-destructive', icon: AlertTriangle };
    return { label: `${days}d remaining`, color: 'bg-warning/10 text-warning', icon: Clock };
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Suppliers</h1>
            <p className="text-muted-foreground">{suppliers.length} suppliers</p>
          </div>
          {isAdmin && (
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No suppliers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((supplier) => {
              const products = supplier.supplier_products || [];
              const totalUnpaid = products
                .filter(p => p.payment_status === 'unpaid')
                .reduce((s, p) => s + p.total_amount, 0);

              return (
                <Card key={supplier.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{supplier.name}</h3>
                          <Badge variant="secondary">{supplier.payment_terms}d terms</Badge>
                          {totalUnpaid > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {formatCurrency(totalUnpaid)} unpaid
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                          {supplier.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {supplier.phone}</span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {supplier.email}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" /> {products.length} supplies
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => getAiInsights(supplier)} disabled={aiLoading} title="AI insights">
                          <Sparkles className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSupplyForm(supplier.id)} title="Add supply">
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(supplier)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(supplier)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}>
                          {expandedId === supplier.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* AI Insights */}
                    {aiInsights && expandedId === supplier.id && (
                      <div className="glass-item mt-3 p-3 text-sm space-y-2">
                        <p className="font-medium flex items-center gap-1"><Sparkles className="w-4 h-4" /> AI Insights</p>
                        <Badge variant={aiInsights.risk_level === 'low' ? 'default' : aiInsights.risk_level === 'high' ? 'destructive' : 'secondary'}>
                          {aiInsights.risk_level} risk
                        </Badge>
                        {aiInsights.insights?.map((i: string, idx: number) => (
                          <p key={idx} className="text-muted-foreground">• {i}</p>
                        ))}
                        {aiInsights.recommendations?.map((r: string, idx: number) => (
                          <p key={idx} className="text-foreground">→ {r}</p>
                        ))}
                      </div>
                    )}

                    {/* Supply Records */}
                    {expandedId === supplier.id && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-medium mb-3">Supply Records</h4>
                        {products.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No supply records</p>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {products.map((product) => {
                              const status = getPaymentStatus(product);
                              const StatusIcon = status.icon;
                              return (
                                <div key={product.id} className="glass-item flex items-center justify-between p-3 text-sm">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">{product.product_name}</p>
                                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                      <span>Qty: {product.quantity}</span>
                                      <span>@ {formatCurrency(product.buying_price)}</span>
                                      <span className="font-medium">{formatCurrency(product.total_amount)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(product.supplied_at), 'dd MMM yyyy')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={status.color}>
                                      <StatusIcon className="w-3 h-3 mr-1" />
                                      {status.label}
                                    </Badge>
                                    {isAdmin && product.payment_status === 'unpaid' && (
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateSupplyPayment(product.id, 'paid')}>
                                        <DollarSign className="w-3 h-3 mr-1" /> Pay
                                      </Button>
                                    )}
                                    {isAdmin && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSupplyRecord(product.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input type="number" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Add Supplier'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Supply Record Dialog */}
      <Dialog open={showSupplyForm} onOpenChange={setShowSupplyForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Supply Record</DialogTitle></DialogHeader>
          <form onSubmit={handleAddSupply} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input value={supplyForm.product_name} onChange={(e) => setSupplyForm({ ...supplyForm, product_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" value={supplyForm.quantity} onChange={(e) => setSupplyForm({ ...supplyForm, quantity: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Buying Price (KES) *</Label>
                <Input type="number" value={supplyForm.buying_price} onChange={(e) => setSupplyForm({ ...supplyForm, buying_price: e.target.value })} required />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Total: {formatCurrency((parseInt(supplyForm.quantity) || 0) * (parseFloat(supplyForm.buying_price) || 0))}
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={supplyForm.notes} onChange={(e) => setSupplyForm({ ...supplyForm, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSupplyForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

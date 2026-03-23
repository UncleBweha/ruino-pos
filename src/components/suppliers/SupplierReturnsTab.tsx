import { useState } from 'react';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import { Loader2, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useReturnsDamages } from '@/hooks/useSupplierTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import type { Supplier } from '@/types/database';

interface Props {
  suppliers: Supplier[];
}

export function SupplierReturnsTab({ suppliers }: Props) {
  const { returns, loading, addReturn } = useReturnsDamages();
  const { products } = useProducts();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '', product_name: '', product_id: '', quantity: '',
    type: 'returned' as 'returned' | 'damaged', reason: '', notes: '',
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addReturn({
        supplier_id: form.supplier_id,
        product_name: form.product_name,
        product_id: form.product_id || undefined,
        quantity: parseInt(form.quantity) || 0,
        type: form.type,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
        created_by: user!.id,
      });
      toast({ title: 'Return/Damage Recorded', description: form.product_id ? 'Stock adjusted automatically' : undefined });
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Returns & Damages</h2>
        <Button onClick={() => { setForm({ supplier_id: '', product_name: '', product_id: '', quantity: '', type: 'returned', reason: '', notes: '' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Record Return
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : returns.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No returns or damages recorded</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {returns.map(r => {
            const sup = suppliers.find(s => s.id === r.supplier_id);
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.product_name}</p>
                      <Badge variant={r.type === 'damaged' ? 'destructive' : 'secondary'}>
                        {r.type === 'damaged' ? <AlertTriangle className="w-3 h-3 mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                        {r.type}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{sup?.name}</span>
                      <span>{format(new Date(r.date_returned), 'dd MMM yyyy')}</span>
                      <span>Qty: {r.quantity}</span>
                      {r.reason && <span>{r.reason}</span>}
                      {r.stock_adjusted && <Badge variant="outline" className="text-xs">Stock adjusted</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Return / Damage</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={form.product_id} onValueChange={v => {
                const prod = products.find(p => p.id === v);
                setForm({ ...form, product_id: v, product_name: prod?.name || '' });
              }}>
                <SelectTrigger><SelectValue placeholder="Select product (for stock adjustment)" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Or type product name manually" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={form.reason} onValueChange={v => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="defective">Defective</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            {form.product_id && (
              <p className="text-xs text-muted-foreground">Stock will be automatically reduced by {form.quantity || 0} units.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.supplier_id || !form.product_name || !form.quantity}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import { DollarSign, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSupplierPayments } from '@/hooks/useSupplierTracking';
import { useAuth } from '@/contexts/AuthContext';
import type { Supplier } from '@/types/database';
import type { SupplierProductExtended } from '@/types/supplier-tracking';

interface Props {
  suppliers: Supplier[];
}

export function SupplierPaymentsTab({ suppliers }: Props) {
  const { payments, loading, addPayment, refresh } = useSupplierPayments();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    supply_record_id: '',
    amount: '',
    payment_method: 'cash',
    notes: '',
  });

  const selectedSupplier = suppliers.find(s => s.id === form.supplier_id);
  const unpaidRecords = (selectedSupplier?.supplier_products || []).filter(
    (p: any) => p.payment_status !== 'paid'
  ) as unknown as SupplierProductExtended[];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addPayment({
        supplier_id: form.supplier_id,
        supply_record_id: form.supply_record_id || undefined,
        amount: parseFloat(form.amount) || 0,
        payment_method: form.payment_method,
        notes: form.notes || undefined,
        created_by: user!.id,
      });
      toast({ title: 'Payment Recorded' });
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
        <h2 className="text-lg font-semibold">Supplier Payments</h2>
        <Button onClick={() => { setForm({ supplier_id: '', supply_record_id: '', amount: '', payment_method: 'cash', notes: '' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : payments.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No payments recorded yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const sup = suppliers.find(s => s.id === p.supplier_id);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{sup?.name || 'Unknown'}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{format(new Date(p.payment_date), 'dd MMM yyyy')}</span>
                      <Badge variant="secondary">{p.payment_method}</Badge>
                      {p.notes && <span>{p.notes}</span>}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(p.amount)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v, supply_record_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {unpaidRecords.length > 0 && (
              <div className="space-y-2">
                <Label>Link to Supply Record</Label>
                <Select value={form.supply_record_id} onValueChange={v => setForm({ ...form, supply_record_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional - select record" /></SelectTrigger>
                  <SelectContent>
                    {unpaidRecords.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.product_name} - {formatCurrency(r.balance)} bal ({r.grn_number || 'No GRN'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.supplier_id || !form.amount}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

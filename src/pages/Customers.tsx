import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import {
  Search, Plus, Edit2, Trash2, Loader2, Phone, MapPin, Building2, UserCircle,
  ChevronDown, ChevronUp, Download, Sparkles, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Customer, Sale } from '@/types/database';

const CATEGORIES = ['retail', 'wholesale', 'loyal', 'occasional'];

export default function CustomersPage() {
  const { customers, loading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [creditCheck, setCreditCheck] = useState<any>(null);

  const [form, setForm] = useState({
    name: '', phone: '', business_name: '', location: '', category: 'retail', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const filtered = searchQuery
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.business_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers;

  function openAdd() {
    setEditing(null);
    setForm({ name: '', phone: '', business_name: '', location: '', category: 'retail', notes: '' });
    setShowForm(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone || '',
      business_name: customer.business_name || '',
      location: customer.location || '',
      category: customer.category || 'retail',
      notes: customer.notes || '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
        toast({ title: 'Customer Updated', description: `${form.name} has been updated` });
      } else {
        await createCustomer(form as any);
        toast({ title: 'Customer Added', description: `${form.name} has been added` });
      }
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete ${customer.name}?`)) return;
    try {
      await deleteCustomer(customer.id);
      toast({ title: 'Deleted', description: `${customer.name} removed` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  }

  async function toggleExpand(customer: Customer) {
    if (expandedId === customer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(customer.id);
    setSalesLoading(true);
    try {
      const { data } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setCustomerSales((data || []) as unknown as Sale[]);
    } catch {
      setCustomerSales([]);
    } finally {
      setSalesLoading(false);
    }
  }

  async function aiCategorize(customer: Customer) {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'categorize_customer',
          data: {
            name: customer.name,
            phone: customer.phone,
            business_name: customer.business_name,
            location: customer.location,
          },
        },
      });
      if (error) throw error;
      if (data?.category) {
        await updateCustomer(customer.id, { category: data.category });
        toast({ title: 'AI Suggestion', description: `Categorized as ${data.category}: ${data.reason}` });
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'Could not get AI suggestion', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  async function checkCreditEligibility(customer: Customer) {
    setAiLoading(true);
    setCreditCheck(null);
    try {
      const { data: sales } = await supabase
        .from('sales')
        .select('total')
        .eq('customer_id', customer.id);

      const { data: credits } = await supabase
        .from('credits')
        .select('balance')
        .eq('customer_name', customer.name)
        .eq('status', 'pending');

      const totalSpent = sales?.reduce((s, r) => s + Number(r.total), 0) || 0;
      const outstanding = credits?.reduce((s, r) => s + Number(r.balance), 0) || 0;

      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'credit_eligibility',
          data: {
            name: customer.name,
            total_purchases: sales?.length || 0,
            total_spent: totalSpent,
            outstanding_credit: outstanding,
          },
        },
      });
      if (error) throw error;
      setCreditCheck(data);
    } catch {
      toast({ title: 'AI Error', description: 'Could not check eligibility', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'wholesale': return 'bg-info/10 text-info';
      case 'loyal': return 'bg-success/10 text-success';
      case 'occasional': return 'bg-warning/10 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">{customers.length} customers</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or business..."
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
              <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No customers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((customer) => (
              <Card key={customer.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{customer.name}</h3>
                        <Badge variant="secondary" className={categoryColor(customer.category)}>
                          {customer.category}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {customer.phone}
                          </span>
                        )}
                        {customer.business_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" /> {customer.business_name}
                          </span>
                        )}
                        {customer.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {customer.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => aiCategorize(customer)} disabled={aiLoading} title="AI categorize">
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => checkCreditEligibility(customer)} disabled={aiLoading} title="Check credit eligibility">
                        <CreditCard className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(customer)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(customer)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpand(customer)}>
                        {expandedId === customer.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Credit Check Result */}
                  {creditCheck && expandedId === customer.id && (
                    <div className="glass-item mt-3 p-3 text-sm">
                      <p className="font-medium mb-1">Credit Eligibility</p>
                      <p>Eligible: <Badge variant={creditCheck.eligible ? 'default' : 'destructive'}>{creditCheck.eligible ? 'Yes' : 'No'}</Badge></p>
                      {creditCheck.limit && <p>Suggested limit: {formatCurrency(creditCheck.limit)}</p>}
                      <p className="text-muted-foreground mt-1">{creditCheck.reason}</p>
                    </div>
                  )}

                  {/* Purchase History */}
                  {expandedId === customer.id && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-medium mb-3">Purchase History</h4>
                      {salesLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : customerSales.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No purchases recorded</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {customerSales.map((sale) => (
                            <div key={sale.id} className="glass-item flex items-center justify-between p-2 text-sm">
                              <div>
                                <p className="font-medium">#{sale.receipt_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(sale.created_at), 'dd MMM yyyy HH:mm')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold currency">{formatCurrency(sale.total)}</p>
                                <Badge variant="outline" className="text-xs capitalize">{sale.payment_method}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254..." />
              </div>
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Add Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, Plus, Edit2, Trash2, Loader2, Phone, MapPin, Building2, UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/types/database';

const CATEGORIES = ['retail', 'wholesale', 'loyal', 'occasional'];

export default function CustomersPage() {
  const { customers, loading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

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

  function openEdit(customer: Customer, e: React.MouseEvent) {
    e.stopPropagation();
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

  async function handleDelete(customer: Customer, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete ${customer.name}?`)) return;
    try {
      await deleteCustomer(customer.id);
      toast({ title: 'Deleted', description: `${customer.name} removed` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
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
              {searchQuery && (
                <Button className="mt-3" onClick={() => { setForm({ name: searchQuery, phone: '', business_name: '', location: '', category: 'retail', notes: '' }); setEditing(null); setShowForm(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add "{searchQuery}" as customer
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((customer) => (
              <Card
                key={customer.id}
                className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg hover:text-primary transition-colors">{customer.name}</h3>
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
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEdit(customer, e)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDelete(customer, e)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
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

import { useState } from 'react';
import { useCasuals } from '@/hooks/useCasuals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Trash2, Edit2, User, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/constants';
import type { Casual } from '@/types/database';

export function CasualManagement() {
  const { casuals, loading, createCasual, updateCasual, deleteCasual } = useCasuals();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editingCasual, setEditingCasual] = useState<Casual | null>(null);
  const [deletingCasual, setDeletingCasual] = useState<Casual | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    commission_rate: '0',
    commission_type: 'percentage' as 'percentage' | 'fixed',
  });

  const resetForm = () => {
    setForm({ full_name: '', phone: '', commission_rate: '0', commission_type: 'percentage' });
  };

  const openEdit = (casual: Casual) => {
    setEditingCasual(casual);
    setForm({
      full_name: casual.full_name,
      phone: casual.phone || '',
      commission_rate: casual.commission_rate.toString(),
      commission_type: casual.commission_type,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;

    setSaving(true);
    try {
      const params = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        commission_rate: parseFloat(form.commission_rate) || 0,
        commission_type: form.commission_type,
      };

      if (editingCasual) {
        await updateCasual(editingCasual.id, params);
        setEditingCasual(null);
      } else {
        await createCasual(params);
        setShowAdd(false);
      }
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save casual',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCasual) return;
    try {
      await deleteCasual(deletingCasual.id);
      setDeletingCasual(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete casual',
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (casual: Casual) => {
    try {
      await updateCasual(casual.id, {
        status: casual.status === 'active' ? 'inactive' : 'active',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const formDialog = (
    <Dialog
      open={showAdd || !!editingCasual}
      onOpenChange={() => {
        setShowAdd(false);
        setEditingCasual(null);
        resetForm();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCasual ? 'Edit Casual' : 'Add Casual'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+254 700 000 000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Commission Type</Label>
              <Select
                value={form.commission_type}
                onValueChange={(v) => setForm({ ...form, commission_type: v as 'percentage' | 'fixed' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (per item)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Commission {form.commission_type === 'percentage' ? '(%)' : '(KES)'}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setEditingCasual(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCasual ? 'Save Changes' : 'Add Casual'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Casual Workers</CardTitle>
            <CardDescription>
              Manage casual profiles for sales attribution and commission tracking
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Casual
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : casuals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No casual workers added yet</p>
              <p className="text-sm">Add casual profiles for sales attribution</p>
            </div>
          ) : (
            <div className="space-y-2">
              {casuals.map((casual) => (
                <div
                  key={casual.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{casual.full_name}</p>
                        <Badge
                          variant={casual.status === 'active' ? 'default' : 'secondary'}
                          className="text-2xs rounded-full capitalize"
                        >
                          {casual.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {casual.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {casual.phone}
                          </span>
                        )}
                        <span>
                          Commission: {casual.commission_type === 'percentage'
                            ? `${casual.commission_rate}%`
                            : formatCurrency(casual.commission_rate)
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleToggleStatus(casual)}
                      title={casual.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {casual.status === 'active' ? (
                        <ToggleRight className="w-4 h-4 text-success" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => openEdit(casual)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingCasual(casual)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {formDialog}

      <AlertDialog open={!!deletingCasual} onOpenChange={() => setDeletingCasual(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Casual</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingCasual?.full_name}</strong>?
              Sales previously attributed to them will retain their name but lose the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExpenditures, EXPENSE_CATEGORIES, type Expenditure, type SalaryRecord, type CasualWageEntry } from '@/hooks/useExpenditures';
import { useUsers } from '@/hooks/useUsers';
import { useCasuals } from '@/hooks/useCasuals';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, PAYMENT_METHODS } from '@/lib/constants';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Edit2, Loader2, DollarSign, Users, Briefcase,
  TrendingDown, Calendar,
} from 'lucide-react';

export default function ExpendituresPage() {
  const {
    expenditures, salaryRecords, casualWages, loading,
    addExpenditure, updateExpenditure, deleteExpenditure,
    addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
    addCasualWage, updateCasualWage, deleteCasualWage,
    getMonthlyExpenditure, getTodayExpenditure,
  } = useExpenditures();
  const { users } = useUsers();
  const { activeCasuals } = useCasuals();
  const { toast } = useToast();

  const cashiers = users.filter(u => u.role === 'cashier');
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyTotal = getMonthlyExpenditure(currentMonth);
  const todayTotal = getTodayExpenditure();

  // --- Expense Dialog State ---
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expenditure | null>(null);
  const [expForm, setExpForm] = useState({ category: 'miscellaneous', description: '', amount: '', payment_method: 'cash', expense_date: format(new Date(), 'yyyy-MM-dd'), status: 'paid', notes: '' });

  // --- Salary Dialog State ---
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryRecord | null>(null);
  const [salForm, setSalForm] = useState({ user_id: '', full_name: '', month: currentMonth, amount: '', payment_method: 'cash', status: 'pending', notes: '' });

  // --- Casual Wage Dialog State ---
  const [wageDialog, setWageDialog] = useState(false);
  const [editingWage, setEditingWage] = useState<CasualWageEntry | null>(null);
  const [wageForm, setWageForm] = useState({ casual_id: '', casual_name: '', work_date: format(new Date(), 'yyyy-MM-dd'), amount: '', payment_method: 'cash', status: 'pending', notes: '' });

  const [saving, setSaving] = useState(false);

  // === Handlers ===
  async function handleSaveExpense() {
    if (!expForm.amount || Number(expForm.amount) <= 0) return;
    setSaving(true);
    try {
      const data = { ...expForm, amount: Number(expForm.amount), expense_date: new Date(expForm.expense_date).toISOString() };
      if (editingExpense) {
        await updateExpenditure(editingExpense.id, data);
        toast({ title: 'Expense Updated' });
      } else {
        await addExpenditure(data);
        toast({ title: 'Expense Added' });
      }
      setExpenseDialog(false);
      setEditingExpense(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function handleSaveSalary() {
    if (!salForm.amount || Number(salForm.amount) <= 0 || !salForm.user_id) return;
    setSaving(true);
    try {
      const data = {
        ...salForm,
        amount: Number(salForm.amount),
        payment_date: salForm.status === 'paid' ? new Date().toISOString() : null,
      };
      if (editingSalary) {
        await updateSalaryRecord(editingSalary.id, data);
        toast({ title: 'Salary Record Updated' });
      } else {
        await addSalaryRecord(data);
        toast({ title: 'Salary Record Added' });
      }
      setSalaryDialog(false);
      setEditingSalary(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function handleSaveWage() {
    if (!wageForm.amount || Number(wageForm.amount) <= 0 || !wageForm.casual_id) return;
    setSaving(true);
    try {
      const data = { ...wageForm, amount: Number(wageForm.amount) };
      if (editingWage) {
        await updateCasualWage(editingWage.id, data);
        toast({ title: 'Wage Entry Updated' });
      } else {
        await addCasualWage(data);
        toast({ title: 'Wage Entry Added' });
      }
      setWageDialog(false);
      setEditingWage(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  function openEditExpense(exp: Expenditure) {
    setEditingExpense(exp);
    setExpForm({
      category: exp.category,
      description: exp.description || '',
      amount: String(exp.amount),
      payment_method: exp.payment_method,
      expense_date: exp.expense_date.split('T')[0],
      status: exp.status,
      notes: exp.notes || '',
    });
    setExpenseDialog(true);
  }

  function openEditSalary(sal: SalaryRecord) {
    setEditingSalary(sal);
    setSalForm({
      user_id: sal.user_id,
      full_name: sal.full_name,
      month: sal.month,
      amount: String(sal.amount),
      payment_method: sal.payment_method,
      status: sal.status,
      notes: sal.notes || '',
    });
    setSalaryDialog(true);
  }

  function openEditWage(w: CasualWageEntry) {
    setEditingWage(w);
    setWageForm({
      casual_id: w.casual_id,
      casual_name: w.casual_name,
      work_date: w.work_date,
      amount: String(w.amount),
      payment_method: w.payment_method,
      status: w.status,
      notes: w.notes || '',
    });
    setWageDialog(true);
  }

  const paymentMethodOptions = PAYMENT_METHODS.filter(m => m.id !== 'credit');

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Expenditures</h1>
            <p className="text-muted-foreground">Track all business expenses, salaries, and wages</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="w-3.5 h-3.5" /> Today's Expenses</div>
              <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(todayTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> Monthly Expenses</div>
              <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(monthlyTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> Salary Records</div>
              <p className="text-xl font-bold mt-1">{salaryRecords.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="w-3.5 h-3.5" /> Wage Entries</div>
              <p className="text-xl font-bold mt-1">{casualWages.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="expenses">
          <TabsList>
            <TabsTrigger value="expenses">Other Expenses</TabsTrigger>
            <TabsTrigger value="salaries">Salaries</TabsTrigger>
            <TabsTrigger value="wages">Casual Wages</TabsTrigger>
          </TabsList>

          {/* === Other Expenses Tab === */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingExpense(null); setExpForm({ category: 'miscellaneous', description: '', amount: '', payment_method: 'cash', expense_date: format(new Date(), 'yyyy-MM-dd'), status: 'paid', notes: '' }); setExpenseDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Expense
              </Button>
            </div>
            <div className="space-y-2">
              {expenditures.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No expenses recorded</CardContent></Card>
              ) : expenditures.map(exp => (
                <Card key={exp.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{exp.description || exp.category}</p>
                        <Badge variant="outline" className="text-xs capitalize">{exp.category}</Badge>
                        <Badge variant={exp.status === 'paid' ? 'default' : 'destructive'} className="text-xs">{exp.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(exp.expense_date), 'MMM dd, yyyy')} · {exp.payment_method}
                        {exp.notes && ` · ${exp.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-destructive">{formatCurrency(exp.amount)}</p>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditExpense(exp)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await deleteExpenditure(exp.id); toast({ title: 'Expense Deleted' }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* === Salaries Tab === */}
          <TabsContent value="salaries" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingSalary(null); setSalForm({ user_id: '', full_name: '', month: currentMonth, amount: '', payment_method: 'cash', status: 'pending', notes: '' }); setSalaryDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Salary
              </Button>
            </div>
            <div className="space-y-2">
              {salaryRecords.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No salary records</CardContent></Card>
              ) : salaryRecords.map(sal => (
                <Card key={sal.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{sal.full_name}</p>
                        <Badge variant="secondary" className="text-xs">Cashier</Badge>
                        <Badge variant={sal.status === 'paid' ? 'default' : 'destructive'} className="text-xs capitalize">{sal.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Month: {sal.month} · {sal.payment_method}
                        {sal.payment_date && ` · Paid: ${format(new Date(sal.payment_date), 'MMM dd')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-destructive">{formatCurrency(sal.amount)}</p>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSalary(sal)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await deleteSalaryRecord(sal.id); toast({ title: 'Salary Deleted' }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* === Casual Wages Tab === */}
          <TabsContent value="wages" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingWage(null); setWageForm({ casual_id: '', casual_name: '', work_date: format(new Date(), 'yyyy-MM-dd'), amount: '', payment_method: 'cash', status: 'pending', notes: '' }); setWageDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Wage Entry
              </Button>
            </div>
            <div className="space-y-2">
              {casualWages.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No wage entries</CardContent></Card>
              ) : casualWages.map(w => (
                <Card key={w.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{w.casual_name}</p>
                        <Badge variant="secondary" className="text-xs">Casual</Badge>
                        <Badge variant={w.status === 'paid' ? 'default' : 'destructive'} className="text-xs capitalize">{w.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Date: {w.work_date} · {w.payment_method}
                        {w.notes && ` · ${w.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-destructive">{formatCurrency(w.amount)}</p>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditWage(w)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await deleteCasualWage(w.id); toast({ title: 'Wage Deleted' }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* === Expense Dialog === */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly rent payment" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Select value={expForm.payment_method} onValueChange={v => setExpForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={expForm.status} onValueChange={v => setExpForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={expForm.notes} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveExpense} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Salary Dialog === */}
      <Dialog open={salaryDialog} onOpenChange={setSalaryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSalary ? 'Edit Salary Record' : 'Add Salary Record'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cashier</Label>
              <Select value={salForm.user_id} onValueChange={v => {
                const u = cashiers.find(c => c.user_id === v);
                setSalForm(f => ({ ...f, user_id: v, full_name: u?.full_name || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select cashier..." /></SelectTrigger>
                <SelectContent>
                  {cashiers.map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Input type="month" value={salForm.month} onChange={e => setSalForm(f => ({ ...f, month: e.target.value }))} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={salForm.amount} onChange={e => setSalForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Select value={salForm.payment_method} onValueChange={v => setSalForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={salForm.status} onValueChange={v => setSalForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={salForm.notes} onChange={e => setSalForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSalary} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Casual Wage Dialog === */}
      <Dialog open={wageDialog} onOpenChange={setWageDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWage ? 'Edit Wage Entry' : 'Add Wage Entry'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Casual Worker</Label>
              <Select value={wageForm.casual_id} onValueChange={v => {
                const c = activeCasuals.find(x => x.id === v);
                setWageForm(f => ({ ...f, casual_id: v, casual_name: c?.full_name || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select worker..." /></SelectTrigger>
                <SelectContent>
                  {activeCasuals.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={wageForm.work_date} onChange={e => setWageForm(f => ({ ...f, work_date: e.target.value }))} />
              </div>
              <div>
                <Label>Amount Earned</Label>
                <Input type="number" value={wageForm.amount} onChange={e => setWageForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Select value={wageForm.payment_method} onValueChange={v => setWageForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={wageForm.status} onValueChange={v => setWageForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={wageForm.notes} onChange={e => setWageForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWageDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWage} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

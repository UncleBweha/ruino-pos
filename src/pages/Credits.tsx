import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCredits } from '@/hooks/useCredits';
import { formatCurrency, CREDIT_STATUSES, PAYMENT_METHODS } from '@/lib/constants';
import {
  CreditCard,
  CheckCircle,
  RotateCcw,
  Loader2,
  User,
  Calendar,
  ChevronRight,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Credit } from '@/types/database';
import { cn } from '@/lib/utils';
import { CreditDetailDialog } from '@/components/credits/CreditDetailDialog';

type StatusFilter = 'all' | 'pending' | 'paid';

export default function CreditsPage() {
  const {
    credits,
    pendingCredits,
    totalPendingAmount,
    loading,
    markAsPaid,
    markAsReturned,
  } = useCredits();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [detailCredit, setDetailCredit] = useState<Credit | null>(null);
  const [actionType, setActionType] = useState<'pay' | 'return' | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [actionLoading, setActionLoading] = useState(false);

  function openPayDialog(credit: Credit) {
    setSelectedCredit(credit);
    setActionType('pay');
    setPaymentAmount(credit.balance.toString());
    setPaymentMethod('cash');
  }

  function openReturnDialog(credit: Credit) {
    setSelectedCredit(credit);
    setActionType('return');
  }

  function closeDialog() {
    setSelectedCredit(null);
    setActionType(null);
    setPaymentAmount('');
  }

  async function handleAction() {
    if (!selectedCredit) return;
    setActionLoading(true);

    try {
      if (actionType === 'pay') {
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Invalid payment amount');
        }
        await markAsPaid(selectedCredit.id, amount, paymentMethod);
        toast({
          title: 'Payment Recorded',
          description: `${formatCurrency(amount)} received from ${selectedCredit.customer_name} via ${paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'}`,
        });
      } else if (actionType === 'return') {
        await markAsReturned(selectedCredit.id);
        toast({
          title: 'Items Returned',
          description: `Credit for ${selectedCredit.customer_name} has been cancelled`,
        });
      }
      closeDialog();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Action failed',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const config = CREDIT_STATUSES[status as keyof typeof CREDIT_STATUSES];
    return (
      <Badge
        variant="outline"
        className={cn(
          status === 'paid' && 'status-completed',
          status === 'pending' && 'status-pending',
          status === 'returned' && 'status-voided'
        )}
      >
        {config?.label || status}
      </Badge>
    );
  }

  // Filter credits based on status
  const paidCredits = credits.filter((c) => c.status === 'paid');
  const filteredCredits = statusFilter === 'all' 
    ? credits 
    : statusFilter === 'pending' 
      ? pendingCredits 
      : paidCredits;

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Credit Management</h1>
          <p className="text-muted-foreground">
            {pendingCredits.length} pending • {formatCurrency(totalPendingAmount)} total owed
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            size="sm"
          >
            All ({credits.length})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            size="sm"
            className={statusFilter === 'pending' ? '' : 'border-warning/50 text-warning hover:bg-warning/10'}
          >
            Unpaid ({pendingCredits.length})
          </Button>
          <Button
            variant={statusFilter === 'paid' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('paid')}
            size="sm"
            className={statusFilter === 'paid' ? '' : 'border-success/50 text-success hover:bg-success/10'}
          >
            Paid ({paidCredits.length})
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold">{credits.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-warning">{pendingCredits.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Owed</p>
              <p className="text-2xl font-bold text-destructive currency">
                {formatCurrency(totalPendingAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Paid This Month</p>
              <p className="text-2xl font-bold text-success">
                {paidCredits.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Credits List */}
        <Card>
          <CardHeader>
            <CardTitle>All Credits</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : credits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No credits found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {credits.map((credit) => (
                  <div
                    key={credit.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => setDetailCredit(credit)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{credit.customer_name}</p>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(credit.created_at), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="font-bold text-lg currency">
                            {formatCurrency(credit.balance)}
                          </p>
                          {credit.amount_paid > 0 && (
                            <p className="text-xs text-success">
                              Paid: {formatCurrency(credit.amount_paid)}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(credit.status)}
                      </div>
                    </div>

                    {credit.status === 'pending' && (
                      <div className="flex gap-2 mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPayDialog(credit);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Record Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReturnDialog(credit);
                          }}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Items Returned
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!selectedCredit && !!actionType} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'pay' ? 'Record Payment' : 'Mark as Returned'}
            </DialogTitle>
          </DialogHeader>

          {actionType === 'pay' && selectedCredit && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-semibold">{selectedCredit.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold currency">
                  {formatCurrency(selectedCredit.balance)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Payment Amount</label>
                <Input
                  type="number"
                  min="0"
                  max={selectedCredit.balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {actionType === 'return' && selectedCredit && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Are you sure the items have been returned by{' '}
                <strong>{selectedCredit.customer_name}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                This will cancel the credit and return items to inventory.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
              variant={actionType === 'return' ? 'destructive' : 'default'}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : actionType === 'pay' ? (
                'Record Payment'
              ) : (
                'Confirm Return'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Detail Dialog */}
      <CreditDetailDialog
        credit={detailCredit}
        open={!!detailCredit}
        onOpenChange={(open) => !open && setDetailCredit(null)}
      />
    </AppLayout>
  );
}

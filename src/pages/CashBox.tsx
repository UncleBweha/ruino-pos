import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCashBox } from '@/hooks/useCashBox';
import { formatCurrency } from '@/lib/constants';
import { Wallet, Calendar, ArrowUpRight, Loader2, Banknote, Smartphone, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CashBox } from '@/types/database';

const PAYMENT_SECTIONS = [
  { key: 'cash', label: 'Cash', icon: Banknote, colorClass: 'text-success', bgClass: 'bg-success/10' },
  { key: 'mpesa', label: 'Mpesa Paybill', icon: Smartphone, colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10' },
  { key: 'till', label: 'Till', icon: Smartphone, colorClass: 'text-violet-500', bgClass: 'bg-violet-500/10' },
  { key: 'cheque', label: 'Cheque', icon: FileText, colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10' },
] as const;

function getPaymentKey(tx: CashBox): string {
  if (tx.transaction_type === 'credit_payment') {
    // Extract method from description e.g. "Credit payment from X via cash"
    const match = tx.description?.match(/via (\w+)$/i);
    return match ? match[1].toLowerCase() : 'cash';
  }
  // For sales, extract from description e.g. "Cash sale", "Mpesa paybill sale"
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('mpesa')) return 'mpesa';
  if (desc.includes('till')) return 'till';
  if (desc.includes('cheque')) return 'cheque';
  return 'cash';
}

function groupByPayment(transactions: CashBox[]) {
  const groups: Record<string, { total: number; transactions: CashBox[] }> = {};
  for (const section of PAYMENT_SECTIONS) {
    groups[section.key] = { total: 0, transactions: [] };
  }

  for (const tx of transactions) {
    const key = getPaymentKey(tx);
    if (!groups[key]) groups[key] = { total: 0, transactions: [] };
    groups[key].total += tx.amount;
    groups[key].transactions.push(tx);
  }

  return groups;
}

export default function CashBoxPage() {
  const { todayTotal, loading, getDailyTotal, getTransactionsForDate } = useCashBox();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const displayTransactions = getTransactionsForDate(selectedDate);
  const displayTotal = getDailyTotal(selectedDate);
  const groups = groupByPayment(displayTransactions);

  const isToday =
    format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Cash Box</h1>
            <p className="text-muted-foreground">Daily cash ledger</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                {format(selectedDate, 'MMMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="col-span-full lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isToday ? "Today's Total" : format(selectedDate, 'MMM dd')}
                  </p>
                  <p className="text-3xl font-bold currency">
                    {formatCurrency(displayTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Transactions</p>
              <p className="text-2xl font-bold">{displayTransactions.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Average per Entry</p>
              <p className="text-2xl font-bold currency">
                {displayTransactions.length > 0
                  ? formatCurrency(displayTotal / displayTransactions.length)
                  : formatCurrency(0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment method containers */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {PAYMENT_SECTIONS.map((section) => {
              const group = groups[section.key];
              const Icon = section.icon;

              return (
                <Collapsible key={section.key} defaultOpen>
                  <Card>
                    <CollapsibleTrigger className="w-full text-left">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', section.bgClass)}>
                              <Icon className={cn('w-5 h-5', section.colorClass)} />
                            </div>
                            <div>
                              <CardTitle className="text-base">{section.label}</CardTitle>
                              <p className="text-xs text-muted-foreground">{group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <p className={cn('text-xl font-bold currency', section.colorClass)}>
                            {formatCurrency(group.total)}
                          </p>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-2">
                        {group.transactions.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No transactions</p>
                        ) : group.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40"
                          >
                            <div className="flex items-center gap-3">
                              <ArrowUpRight className={cn('w-4 h-4', section.colorClass)} />
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {tx.transaction_type.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(tx.created_at), 'HH:mm')}
                                  {tx.cashier?.full_name && (
                                    <span className="ml-2">• {tx.cashier.full_name}</span>
                                  )}
                                </p>
                                {tx.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>
                                )}
                              </div>
                            </div>
                            <p className="font-semibold text-sm currency">
                              +{formatCurrency(tx.amount)}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

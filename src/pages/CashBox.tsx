import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCashBox } from '@/hooks/useCashBox';
import { formatCurrency } from '@/lib/constants';
import { Wallet, Calendar, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CashBoxPage() {
  const { transactions, todayTotal, loading, getDailyTotal, getTransactionsForDate } = useCashBox();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const displayTransactions = getTransactionsForDate(selectedDate);
  const displayTotal = getDailyTotal(selectedDate);

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

        {/* Summary */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="col-span-full lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isToday ? "Today's Cash" : format(selectedDate, 'MMM dd')}
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
              <p className="text-sm text-muted-foreground mb-1">Average per Sale</p>
              <p className="text-2xl font-bold currency">
                {displayTransactions.length > 0
                  ? formatCurrency(displayTotal / displayTransactions.length)
                  : formatCurrency(0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : displayTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No cash transactions for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          tx.transaction_type === 'sale'
                            ? 'bg-success/10'
                            : 'bg-info/10'
                        )}
                      >
                        <ArrowUpRight
                          className={cn(
                            'w-5 h-5',
                            tx.transaction_type === 'sale'
                              ? 'text-success'
                              : 'text-info'
                          )}
                        />
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {tx.transaction_type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), 'HH:mm')}
                          {tx.cashier?.full_name && (
                            <span className="ml-2 text-primary">• {tx.cashier.full_name}</span>
                          )}
                        </p>
                        {tx.description && (
                          <p className="text-sm text-muted-foreground">
                            {tx.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-success currency">
                      +{formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

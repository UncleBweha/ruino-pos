import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, User } from 'lucide-react';
import type { DailyReportData } from '@/hooks/useReports';

interface Props {
  cashiers: DailyReportData['bestCashiers'];
  loading: boolean;
}

const formatCurrency = (n: number) =>
  `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

export function ReportBestCashiers({ cashiers, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Best Employees</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 w-full rounded" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Best Performing Employees
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cashiers.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No employee data</p>
        ) : (
          <div className="space-y-3">
            {cashiers.map((cashier, index) => (
              <div
                key={cashier.cashier_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  {index < 3 ? (
                    <Trophy className={`w-4 h-4 ${MEDAL_COLORS[index]}`} />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{cashier.cashier_name}</p>
                  <p className="text-xs text-muted-foreground">{cashier.transaction_count} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm currency">{formatCurrency(cashier.total_sales)}</p>
                  <p className="text-xs text-accent font-medium">
                    +{formatCurrency(cashier.total_profit)} profit
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

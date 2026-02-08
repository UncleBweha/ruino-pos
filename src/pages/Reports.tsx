import { AppLayout } from '@/components/layout/AppLayout';
import { useReports } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Printer, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import { ReportHourlyChart } from '@/components/reports/ReportHourlyChart';
import { ReportPaymentBreakdown } from '@/components/reports/ReportPaymentBreakdown';
import { ReportTopProducts } from '@/components/reports/ReportTopProducts';
import { ReportBestCashiers } from '@/components/reports/ReportBestCashiers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ReportsPage() {
  const { report, loading, selectedDate, setSelectedDate, refresh } = useReports();

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const currentHour = new Date().getHours();
  const isAfterClosing = currentHour >= 19; // 7 PM

  const emptyReport = {
    totalSales: 0, totalProfit: 0, totalTransactions: 0, avgTransactionValue: 0,
    cashSales: 0, mpesaSales: 0, creditSales: 0, cashCount: 0, mpesaCount: 0, creditCount: 0,
    topProducts: [], bestCashiers: [], hourlySales: [],
    voidedCount: 0, voidedAmount: 0,
  };

  const displayReport = report || emptyReport;

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
              Daily Report
              {isToday && isAfterClosing && (
                <Badge className="bg-accent text-accent-foreground text-xs">End of Day</Badge>
              )}
            </h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              {isToday && !isAfterClosing && (
                <span className="text-xs ml-2">(Report finalizes at 7:00 PM)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  {format(selectedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <ReportSummaryCards report={displayReport} loading={loading} />

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ReportHourlyChart data={displayReport.hourlySales} loading={loading} />
          </div>
          <ReportPaymentBreakdown report={displayReport} loading={loading} />
        </div>

        {/* Products & Employees */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ReportTopProducts products={displayReport.topProducts} loading={loading} />
          <ReportBestCashiers cashiers={displayReport.bestCashiers} loading={loading} />
        </div>

        {/* Voided Sales Summary */}
        {!loading && displayReport.voidedCount > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Voided Sales</p>
                <p className="text-xs text-muted-foreground">{displayReport.voidedCount} voided transactions</p>
              </div>
              <p className="font-bold text-destructive currency">
                KSh {displayReport.voidedAmount.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

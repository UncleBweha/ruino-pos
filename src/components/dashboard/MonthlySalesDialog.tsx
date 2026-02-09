import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Receipt, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types/database';

interface MonthlySalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthlySalesDialog({ open, onOpenChange }: MonthlySalesDialogProps) {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [filterMode, setFilterMode] = useState<'month' | 'date'>('month');

  // Generate years for dropdown (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    if (open) {
      fetchSales();
    }
  }, [open]);

  async function fetchSales() {
    setLoading(true);
    try {
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .neq('status', 'voided')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch cashier profiles
      const cashierIds = [...new Set(salesData?.map(s => s.cashier_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', cashierIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const salesWithCashier = salesData?.map(sale => ({
        ...sale,
        cashier: profilesMap.get(sale.cashier_id) || null
      })) || [];

      setSales(salesWithCashier as unknown as Sale[]);
    } catch (err) {
      console.error('Failed to fetch sales:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter sales based on selected mode
  const filteredSales = sales.filter(sale => {
    const saleDate = parseISO(sale.created_at);
    
    if (filterMode === 'date' && selectedDate) {
      return format(saleDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    }
    
    // Month filter
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
    return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
  });

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Sales Details</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 pb-4 border-b">
          {/* Filter Mode Toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={filterMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilterMode('month');
                setSelectedDate(undefined);
              }}
            >
              Month
            </Button>
            <Button
              variant={filterMode === 'date' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('date')}
            >
              Specific Date
            </Button>
          </div>

          {filterMode === 'month' ? (
            <>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-xl font-bold currency">{formatCurrency(totalSales)}</p>
          </div>
          {isAdmin && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Profit</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalProfit)}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold">{filteredSales.length}</p>
          </div>
        </div>

        {/* Sales List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No sales found for this period</p>
            </div>
          ) : (
            filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{sale.receipt_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(sale.created_at), 'MMM dd, yyyy • HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold currency">{formatCurrency(sale.total)}</p>
                  <Badge variant="outline" className="text-xs">
                    {sale.payment_method}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

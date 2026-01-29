import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, SALE_STATUSES } from '@/lib/constants';
import { printReceipt, downloadReceipt } from '@/lib/printReceipt';
import {
  Search,
  Receipt,
  Calendar,
  ChevronDown,
  ChevronUp,
  XCircle,
  Loader2,
  Printer,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Sale } from '@/types/database';
import { cn } from '@/lib/utils';

export default function SalesPage() {
  const { sales, loading, voidSale } = useSales();
  const { receiptSettings } = useSettings();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      !searchQuery ||
      sale.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate =
      !selectedDate ||
      format(new Date(sale.created_at), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

    return matchesSearch && matchesDate;
  });

  async function handleVoidSale() {
    if (!voidingSale) return;
    setVoidLoading(true);

    try {
      await voidSale(voidingSale.id);
      toast({
        title: 'Sale Voided',
        description: `Receipt ${voidingSale.receipt_number} has been voided`,
      });
      setVoidingSale(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to void sale',
        variant: 'destructive',
      });
    } finally {
      setVoidLoading(false);
    }
  }

  function handlePrintReceipt(sale: Sale, e: React.MouseEvent) {
    e.stopPropagation();
    printReceipt({ sale, settings: receiptSettings });
    toast({
      title: 'Print Initiated',
      description: `Printing receipt ${sale.receipt_number}`,
    });
  }

  function handleDownloadReceipt(sale: Sale, e: React.MouseEvent) {
    e.stopPropagation();
    downloadReceipt({ sale, settings: receiptSettings });
    toast({
      title: 'Download Started',
      description: `Downloading receipt ${sale.receipt_number}`,
    });
  }

  function getStatusBadge(status: string) {
    const config = SALE_STATUSES[status as keyof typeof SALE_STATUSES];
    return (
      <Badge
        variant="outline"
        className={cn(
          status === 'completed' && 'status-completed',
          status === 'voided' && 'status-voided',
          status === 'credit' && 'status-pending'
        )}
      >
        {config?.label || status}
      </Badge>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">
            {filteredSales.length} sales found
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by receipt or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 w-full sm:w-auto">
                <Calendar className="w-4 h-4 mr-2" />
                {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Filter by date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="pointer-events-auto"
              />
              {selectedDate && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Sales List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No sales found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredSales.map((sale) => (
                  <div key={sale.id}>
                    {/* Sale Row */}
                    <div
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedSale(expandedSale === sale.id ? null : sale.id)
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Receipt className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-medium">
                              {sale.receipt_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(sale.created_at), 'MMM dd, yyyy • HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="font-semibold currency">
                              {formatCurrency(sale.total)}
                            </p>
                            {isAdmin && (
                              <p className="text-sm text-success">
                                +{formatCurrency(sale.profit)}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(sale.status)}
                          {expandedSale === sale.id ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="sm:hidden mt-2 text-right">
                        <p className="font-semibold currency">
                          {formatCurrency(sale.total)}
                        </p>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedSale === sale.id && (
                      <div className="px-4 pb-4 animate-slide-up">
                        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                          {/* Meta Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">POS</p>
                              <p className="font-medium">
                                {sale.cashier?.full_name || 'Unknown'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Customer</p>
                              <p className="font-medium">
                                {sale.customer_name || 'Walk-in'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Payment</p>
                              <p className="font-medium capitalize">
                                {sale.payment_method}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Tax</p>
                              <p className="font-medium">
                                {sale.tax_rate}% ({formatCurrency(sale.tax_amount)})
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Discount</p>
                              <p className="font-medium">
                                {formatCurrency(sale.discount)}
                              </p>
                            </div>
                          </div>

                          {/* Items */}
                          {sale.sale_items && sale.sale_items.length > 0 && (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sale.sale_items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>{item.product_name}</TableCell>
                                      <TableCell className="text-right">
                                        {item.quantity}
                                      </TableCell>
                                      <TableCell className="text-right currency">
                                        {formatCurrency(item.unit_price)}
                                      </TableCell>
                                      <TableCell className="text-right currency font-medium">
                                        {formatCurrency(item.total)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handlePrintReceipt(sale, e)}
                            >
                              <Printer className="w-4 h-4 mr-2" />
                              Print
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleDownloadReceipt(sale, e)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                            {isAdmin && sale.status !== 'voided' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVoidingSale(sale);
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Void Sale
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Void Confirmation Dialog */}
      <Dialog open={!!voidingSale} onOpenChange={() => setVoidingSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Sale</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to void sale{' '}
            <strong>{voidingSale?.receipt_number}</strong>? This will return all
            items to inventory and exclude this sale from reports.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidingSale(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidSale}
              disabled={voidLoading}
            >
              {voidLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Void Sale'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

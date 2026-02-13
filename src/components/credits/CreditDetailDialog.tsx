import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Calendar,
  Printer,
  Download,
  Package,
  CreditCard,
  CheckCircle,
} from 'lucide-react';
import { formatCurrency, CREDIT_STATUSES } from '@/lib/constants';
import { printReceipt, downloadReceipt } from '@/lib/printReceipt';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import type { Credit } from '@/types/database';

interface CreditDetailDialogProps {
  credit: Credit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditDetailDialog({ credit, open, onOpenChange }: CreditDetailDialogProps) {
  const { receiptSettings: settings } = useSettings();
  const [printing, setPrinting] = useState(false);

  if (!credit) return null;

  const sale = credit.sale;
  const items = sale?.sale_items || [];

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

  function handlePrint() {
    if (!sale) return;
    setPrinting(true);
    printReceipt({ sale, settings });
    setTimeout(() => setPrinting(false), 1000);
  }

  async function handleDownload() {
    if (!sale) return;
    await downloadReceipt({ sale, settings });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Credit Details
          </DialogTitle>
        </DialogHeader>

        {/* Customer Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{credit.customer_name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {format(new Date(credit.created_at), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          </div>
          {getStatusBadge(credit.status)}
        </div>

        <Separator />

        {/* Payment Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="glass-item p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Owed</p>
            <p className="font-bold currency">{formatCurrency(credit.total_owed)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">Amount Paid</p>
            <p className="font-bold text-success currency">{formatCurrency(credit.amount_paid)}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="font-bold text-destructive currency">{formatCurrency(credit.balance)}</p>
          </div>
        </div>

        {/* Payment History */}
        {credit.amount_paid > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Payment History
              </h4>
              <div className="space-y-2">
                {credit.status === 'paid' && credit.paid_at && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                    <div>
                      <p className="font-medium text-success">Fully Paid</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(credit.paid_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <p className="font-bold currency">{formatCurrency(credit.amount_paid)}</p>
                  </div>
                )}
                {credit.status === 'pending' && credit.amount_paid > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div>
                      <p className="font-medium text-warning">Partial Payment</p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {format(new Date(credit.updated_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <p className="font-bold currency">{formatCurrency(credit.amount_paid)}</p>
                  </div>
                )}
                {credit.status === 'returned' && credit.returned_at && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted border">
                    <div>
                      <p className="font-medium">Items Returned</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(credit.returned_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Items List */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Items ({items.length})
          </h4>
          {items.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="glass-item flex items-center justify-between p-3"
                >
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-bold currency">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items found
            </p>
          )}
        </div>

        {/* Receipt Number */}
        {sale && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Receipt #</span>
              <span className="font-mono font-bold">{sale.receipt_number}</span>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrint}
            disabled={printing || !sale}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={!sale}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

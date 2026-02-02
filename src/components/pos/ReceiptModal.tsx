import { CheckCircle, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/constants';
import { printReceipt, downloadReceipt } from '@/lib/printReceipt';
import type { Sale, ReceiptSettings } from '@/types/database';

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  receiptSettings: ReceiptSettings | null;
}

export function ReceiptModal({
  open,
  onOpenChange,
  sale,
  receiptSettings,
}: ReceiptModalProps) {
  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            Sale Complete!
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4">
          <div className="bg-muted p-4 rounded-lg font-mono">
            <p className="text-sm text-muted-foreground">Receipt</p>
            <p className="font-bold text-lg">{sale.receipt_number}</p>
            <p className="text-3xl font-bold text-primary mt-2">
              {formatCurrency(sale.total)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {receiptSettings?.company_name || 'Ruinu General Merchants'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => printReceipt({ sale, settings: receiptSettings })}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => downloadReceipt({ sale, settings: receiptSettings })}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            New Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Banknote, Smartphone, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, PAYMENT_METHODS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { CartItem } from '@/types/database';

interface CheckoutPanelProps {
  items: CartItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  customerName: string;
  selectedPayment: 'cash' | 'mpesa' | 'credit';
  checkoutLoading: boolean;
  onTaxRateChange: (rate: number) => void;
  onDiscountChange: (amount: number) => void;
  onCustomerNameChange: (name: string) => void;
  onPaymentChange: (method: 'cash' | 'mpesa' | 'credit') => void;
  onCheckout: () => void;
}

const paymentIcons = {
  cash: Banknote,
  mpesa: Smartphone,
  credit: CreditCard,
};

export function CheckoutPanel({
  items,
  subtotal,
  taxRate,
  taxAmount,
  discount,
  total,
  customerName,
  selectedPayment,
  checkoutLoading,
  onTaxRateChange,
  onDiscountChange,
  onCustomerNameChange,
  onPaymentChange,
  onCheckout,
}: CheckoutPanelProps) {
  // Check if any item has a price at or below buying price
  const hasInvalidPrice = items.some(item => item.unitPrice <= item.product.buying_price);
  const isCartEmpty = items.length === 0;
  const needsCustomerName = selectedPayment === 'credit' && !customerName.trim();

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Customer, Tax, Discount */}
      <div className="p-4 space-y-3 border-b">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">
              Customer {selectedPayment === 'credit' && <span className="text-destructive">*</span>}
            </Label>
            <Input
              placeholder="Walk-in"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              className="h-9 mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tax %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
              className="h-9 mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Discount</Label>
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="h-9 mt-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="p-4 space-y-2 text-sm border-b">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="currency">{formatCurrency(subtotal)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({taxRate}%)</span>
            <span className="currency">{formatCurrency(taxAmount)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-success">
            <span>Discount</span>
            <span className="currency">-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold pt-3 border-t">
          <span>Total</span>
          <span className="currency text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="p-4 space-y-3 flex-1">
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((method) => {
            const Icon = paymentIcons[method.id];
            return (
              <Button
                key={method.id}
                variant={selectedPayment === method.id ? 'default' : 'outline'}
                className={cn(
                  'flex flex-col h-14 gap-1 text-xs',
                  selectedPayment === method.id && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => onPaymentChange(method.id)}
              >
                <Icon className="w-5 h-5" />
                <span>{method.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Complete Sale Button - Sticky */}
      <div className="p-4 border-t bg-card/80 backdrop-blur-sm">
        <Button
          className="w-full h-14 text-lg font-bold"
          disabled={isCartEmpty || checkoutLoading || hasInvalidPrice || needsCustomerName}
          onClick={onCheckout}
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Complete Sale
            </>
          )}
        </Button>
        {hasInvalidPrice && (
          <p className="text-xs text-destructive text-center mt-2">
            Fix prices below cost to complete sale
          </p>
        )}
        {needsCustomerName && (
          <p className="text-xs text-destructive text-center mt-2">
            Customer name required for credit sales
          </p>
        )}
      </div>
    </div>
  );
}

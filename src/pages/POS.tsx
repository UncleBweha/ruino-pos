import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { useCasuals } from '@/hooks/useCasuals';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, PAYMENT_METHODS } from '@/lib/constants';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Banknote, Smartphone, CreditCard, CheckCircle, Printer, Download, Edit2, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Product, Sale, Casual } from '@/types/database';
import { cn } from '@/lib/utils';
import { printReceipt, downloadReceipt } from '@/lib/printReceipt';
import { useIsMobile } from '@/hooks/use-mobile';

export default function POSPage() {
  const { products, loading: productsLoading, searchProducts } = useProducts();
  const {
    items,
    discount,
    taxRate,
    customerName,
    subtotal,
    taxAmount,
    total,
    itemCount,
    addItem,
    removeItem,
    updateQuantity,
    updateUnitPrice,
    setDiscount,
    setTaxRate,
    setCustomerName,
    clearCart,
  } = useCart();
  const { createSale } = useSales();
  const { receiptSettings } = useSettings();
  const { activeCasuals } = useCasuals();
  const { customers, searchCustomers: searchCustomersFn } = useCustomers();
  const { profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'mpesa' | 'credit'>('cash');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  // Sell on behalf state
  const [sellOnBehalf, setSellOnBehalf] = useState(false);
  const [selectedBehalfId, setSelectedBehalfId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  // On mobile, only show products when searching
  const filteredProducts = searchQuery ? searchProducts(searchQuery) : (isMobile ? [] : products);

  const paymentIcons = {
    cash: Banknote,
    mpesa: Smartphone,
    credit: CreditCard,
  };

  // Calculate commission for the sale
  const calculateCommission = (casual: Casual | undefined, saleTotal: number, itemCount: number): number => {
    if (!casual) return 0;
    if (casual.commission_type === 'percentage') {
      return saleTotal * (casual.commission_rate / 100);
    }
    return casual.commission_rate * itemCount;
  };

  // Handle starting price edit
  const handleStartPriceEdit = (productId: string, currentPrice: number) => {
    setEditingPriceId(productId);
    setEditPriceValue(currentPrice.toString());
  };

  // Handle saving price edit
  const handleSavePriceEdit = (productId: string, buyingPrice: number) => {
    const newPrice = parseFloat(editPriceValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price',
        variant: 'destructive',
      });
      return;
    }

    if (newPrice <= buyingPrice) {
      toast({
        title: 'Price Too Low',
        description: `Price must be higher than cost (${formatCurrency(buyingPrice)})`,
        variant: 'destructive',
      });
      return;
    }

    updateUnitPrice(productId, newPrice);
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  // Handle canceling price edit
  const handleCancelPriceEdit = () => {
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  async function handleCheckout() {
    if (items.length === 0) {
      toast({
        title: 'Cart Empty',
        description: 'Add products to the cart first',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPayment === 'credit' && !customerName.trim()) {
      toast({
        title: 'Customer Required',
        description: 'Enter customer name for credit sales',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);

    try {
      // Determine sell-on-behalf details
      let soldOnBehalfOf: string | null = null;
      let soldOnBehalfName: string | null = null;
      let commissionAmount = 0;

      if (sellOnBehalf && selectedBehalfId) {
        const selectedCasual = activeCasuals.find(c => c.id === selectedBehalfId);
        if (selectedCasual) {
          soldOnBehalfOf = selectedCasual.id;
          soldOnBehalfName = selectedCasual.full_name;
          commissionAmount = calculateCommission(selectedCasual, total, itemCount);
        }
      }

      const sale = await createSale({
        items,
        customerName: customerName || undefined,
        customerId: selectedCustomerId || undefined,
        taxRate,
        discount,
        paymentMethod: selectedPayment,
        soldOnBehalfOf,
        soldOnBehalfName,
        commissionAmount,
      });

      setLastSale(sale);
      setShowReceipt(true);
      clearCart();
      setSellOnBehalf(false);
      setSelectedBehalfId('');
      setSelectedCustomerId('');

      toast({
        title: 'Sale Complete',
        description: `Receipt: ${sale.receipt_number}`,
      });
    } catch (error) {
      toast({
        title: 'Checkout Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(false);
    }
  }

  const renderProductCard = (product: Product) => {
    const inCart = items.find((i) => i.product.id === product.id);
    const isOutOfStock = product.quantity <= 0;
    const isLowStock = product.quantity > 0 && product.quantity <= product.low_stock_alert;

    return (
      <button
        key={product.id}
        onClick={() => !isOutOfStock && addItem(product)}
        disabled={isOutOfStock}
        className={cn(
          'pos-product-card text-left w-full relative',
          isOutOfStock && 'opacity-50 cursor-not-allowed',
          inCart && 'ring-2 ring-primary',
          isMobile && 'flex items-center gap-3 p-3'
        )}
      >
        {inCart && (
          <div className={cn(
            "absolute w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center",
            isMobile ? "-top-1 -left-1" : "-top-2 -right-2"
          )}>
            {inCart.quantity}
          </div>
        )}
        <div className={cn(isMobile && "flex-1 min-w-0")}>
          <p className="font-medium truncate">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.sku}</p>
        </div>
        <div className={cn(
          "flex items-center justify-between",
          isMobile && "flex-shrink-0 gap-3"
        )}>
          <p className="font-bold text-primary currency">
            {formatCurrency(product.selling_price)}
          </p>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              isOutOfStock && 'bg-pos-danger text-destructive',
              isLowStock && 'bg-pos-warning text-warning',
              !isOutOfStock && !isLowStock && 'bg-muted text-muted-foreground'
            )}
          >
            {product.quantity}
          </span>
        </div>
      </button>
    );
  };

  return (
    <AppLayout className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0 lg:overflow-hidden">
        <div className="p-4 glass-divider border-b glass-section">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-4", isMobile && !searchQuery && "hidden")}>
          {productsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No products found
            </div>
          ) : (
            <div className={cn(
              "gap-3",
              isMobile ? "flex flex-col" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            )}>
              {filteredProducts.map((product) => renderProductCard(product))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="lg:w-96 xl:w-[420px] glass-divider border-t lg:border-t-0 lg:border-l glass-section flex flex-col">
        {/* Cart Header */}
        <div className="p-4 glass-divider border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-bold">Cart</h2>
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              Clear
            </Button>
          )}
        </div>

        {/* Sell on Behalf Toggle */}
        <div className="px-4 py-3 glass-divider border-b bg-background/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium cursor-pointer" htmlFor="sell-on-behalf">
                Sell on behalf
              </Label>
            </div>
            <Switch
              id="sell-on-behalf"
              checked={sellOnBehalf}
              onCheckedChange={(checked) => {
                setSellOnBehalf(checked);
                if (!checked) setSelectedBehalfId('');
              }}
            />
          </div>
          {sellOnBehalf && (
            <div className="mt-2">
              <Select value={selectedBehalfId} onValueChange={setSelectedBehalfId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select person..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCasuals.map((casual) => (
                    <SelectItem key={casual.id} value={casual.id}>
                      {casual.full_name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({casual.commission_type === 'percentage' 
                          ? `${casual.commission_rate}%` 
                          : `${formatCurrency(casual.commission_rate)}/item`})
                      </span>
                    </SelectItem>
                  ))}
                  {activeCasuals.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No active casuals. Add them in Settings → Casuals.
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedBehalfId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Commission: {formatCurrency(
                    calculateCommission(
                      activeCasuals.find(c => c.id === selectedBehalfId),
                      total,
                      itemCount
                    )
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh] lg:max-h-none">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Cart is empty</p>
              <p className="text-sm">Tap products to add</p>
            </div>
          ) : (
            items.map((item) => {
              const isEditing = editingPriceId === item.product.id;
              const isPriceModified = item.unitPrice !== item.product.selling_price;
              
              return (
                <div key={item.product.id} className="glass-item flex items-center gap-4 border-l-4 border-l-transparent hover:border-l-accent">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{item.product.name}</p>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          className="h-10 w-28 text-base"
                          min={item.product.buying_price + 1}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSavePriceEdit(item.product.id, item.product.buying_price);
                            } else if (e.key === 'Escape') {
                              handleCancelPriceEdit();
                            }
                          }}
                        />
                        <Button
                          variant="default"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => handleSavePriceEdit(item.product.id, item.product.buying_price)}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <span 
                          className={cn(
                            "text-base",
                            isPriceModified && 'text-warning font-medium'
                          )}
                        >
                          {formatCurrency(item.unitPrice)}
                        </span>
                        <span className="text-base">× {item.quantity}</span>
                        {isPriceModified && (
                          <span className="text-xs line-through">
                            ({formatCurrency(item.product.selling_price)})
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleStartPriceEdit(item.product.id, item.unitPrice)}
                          title="Edit price"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.quantity}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-pos-danger"
                      onClick={() => removeItem(item.product.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-4 glass-divider border-t space-y-3 bg-background/40">
          {/* Customer, Tax & Discount - Compact Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <Label className="text-xs">Customer {selectedPayment === 'credit' && <span className="text-destructive">*</span>}</Label>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerSearchOpen(true);
                  if (!e.target.value.trim()) {
                    setSelectedCustomerId('');
                  }
                }}
                onFocus={() => setCustomerSearchOpen(true)}
                onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 200)}
                placeholder="Walk-in"
                className="h-9 mt-0.5 text-sm"
                autoComplete="off"
              />
              {customerSearchOpen && customerName.trim() && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {customers
                    .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                    .slice(0, 8)
                    .map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedCustomerId(c.id);
                          setCustomerName(c.name);
                          setCustomerSearchOpen(false);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
                      </button>
                    ))}
                  {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">New customer: "{customerName}"</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Tax (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={taxRate || ''}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="h-9 mt-0.5 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">Discount</Label>
              <Input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="h-9 mt-0.5 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="currency">{formatCurrency(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="currency">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span className="currency">-{formatCurrency(discount)}</span>
              </div>
            )}
            {sellOnBehalf && selectedBehalfId && (
              <div className="flex justify-between text-muted-foreground">
                <span>Commission</span>
                <span className="currency">
                  {formatCurrency(
                    calculateCommission(
                      activeCasuals.find(c => c.id === selectedBehalfId),
                      total,
                      itemCount
                    )
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="currency">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const Icon = paymentIcons[method.id];
              return (
                <Button
                  key={method.id}
                  variant={selectedPayment === method.id ? 'default' : 'outline'}
                  className={cn(
                    'flex flex-col h-16 gap-1',
                    selectedPayment === method.id && 'ring-2 ring-primary ring-offset-2'
                  )}
                  onClick={() => setSelectedPayment(method.id)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{method.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full h-14 text-lg font-bold"
            disabled={items.length === 0 || checkoutLoading}
            onClick={handleCheckout}
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
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
              Sale Complete!
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="text-center space-y-4">
              <div className="glass-item p-4 font-mono">
                <p className="font-bold text-lg">{lastSale.receipt_number}</p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(lastSale.total)}
                </p>
                {lastSale.sold_on_behalf_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sold by: {lastSale.sold_on_behalf_name}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {receiptSettings?.company_name || 'Ruinu General Merchants'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => printReceipt({ sale: lastSale, settings: receiptSettings })}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadReceipt({ sale: lastSale, settings: receiptSettings })}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              <Button className="w-full" onClick={() => setShowReceipt(false)}>
                New Sale
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

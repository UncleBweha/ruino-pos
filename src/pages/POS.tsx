import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, PAYMENT_METHODS } from '@/lib/constants';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Banknote, Smartphone, CreditCard, CheckCircle, Printer, Download, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Product, Sale } from '@/types/database';
import { cn } from '@/lib/utils';
import { printReceipt, downloadReceipt } from '@/lib/printReceipt';

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
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'mpesa' | 'credit'>('cash');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const filteredProducts = searchQuery ? searchProducts(searchQuery) : products;

  const paymentIcons = {
    cash: Banknote,
    mpesa: Smartphone,
    credit: CreditCard,
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
      const sale = await createSale({
        items,
        customerName: customerName || undefined,
        taxRate,
        discount,
        paymentMethod: selectedPayment,
      });

      setLastSale(sale);
      setShowReceipt(true);
      clearCart();

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
          inCart && 'ring-2 ring-primary'
        )}
      >
        {inCart && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
            {inCart.quantity}
          </div>
        )}
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground mb-1">{product.sku}</p>
        <div className="flex items-center justify-between">
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
        <div className="p-4 border-b bg-card">
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

        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? 'No products found' : 'No products available'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => renderProductCard(product))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="lg:w-96 xl:w-[420px] border-t lg:border-t-0 lg:border-l bg-card flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between">
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
                <div key={item.product.id} className="pos-cart-item p-5">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <span className="w-8 text-center font-bold text-base">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.quantity}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:bg-pos-danger"
                      onClick={() => removeItem(item.product.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-4 border-t space-y-3 bg-muted/30">
          {/* Customer, Tax & Discount - Compact Row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Customer {selectedPayment === 'credit' && <span className="text-destructive">*</span>}</Label>
              <Input
                placeholder="Walk-in"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-9 mt-0.5 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Tax (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="h-9 mt-0.5 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Discount</Label>
              <Input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="h-9 mt-0.5 text-sm"
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
              <div className="bg-muted p-4 rounded-lg font-mono">
                <p className="font-bold text-lg">{lastSale.receipt_number}</p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(lastSale.total)}
                </p>
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

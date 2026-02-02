import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutPanel } from '@/components/pos/CheckoutPanel';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import type { Sale } from '@/types/database';

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
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'mpesa' | 'credit'>('cash');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const filteredProducts = searchQuery ? searchProducts(searchQuery) : products;

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

    // Check for invalid prices
    const hasInvalidPrice = items.some(item => item.unitPrice <= item.product.buying_price);
    if (hasInvalidPrice) {
      toast({
        title: 'Invalid Prices',
        description: 'Some items have prices at or below cost',
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

  return (
    <AppLayout className="flex flex-col h-screen overflow-hidden">
      {/* Main 3-column layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left: Product Grid (compact) */}
        <div className="lg:w-[35%] xl:w-[30%] flex flex-col min-h-0 border-r bg-background order-2 lg:order-1">
          <ProductGrid
            products={filteredProducts}
            loading={productsLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cartItems={items}
            onAddItem={addItem}
          />
        </div>

        {/* Center: Cart Panel (primary focus - bigger) */}
        <div className="lg:flex-1 xl:w-[40%] flex flex-col min-h-0 border-r bg-card order-1 lg:order-2 max-h-[40vh] lg:max-h-none">
          <CartPanel
            items={items}
            isAdmin={isAdmin}
            onUpdateQuantity={updateQuantity}
            onUpdatePrice={updateUnitPrice}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
          />
        </div>

        {/* Right: Checkout Panel (sticky actions) */}
        <div className="lg:w-[25%] xl:w-[30%] flex flex-col min-h-0 order-3">
          <CheckoutPanel
            items={items}
            subtotal={subtotal}
            taxRate={taxRate}
            taxAmount={taxAmount}
            discount={discount}
            total={total}
            customerName={customerName}
            selectedPayment={selectedPayment}
            checkoutLoading={checkoutLoading}
            onTaxRateChange={setTaxRate}
            onDiscountChange={setDiscount}
            onCustomerNameChange={setCustomerName}
            onPaymentChange={setSelectedPayment}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={showReceipt}
        onOpenChange={setShowReceipt}
        sale={lastSale}
        receiptSettings={receiptSettings}
      />
    </AppLayout>
  );
}

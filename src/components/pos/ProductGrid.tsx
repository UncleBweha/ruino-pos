import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/constants';
import type { Product, CartItem } from '@/types/database';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cartItems: CartItem[];
  onAddItem: (product: Product) => void;
}

export function ProductGrid({
  products,
  loading,
  searchQuery,
  onSearchChange,
  cartItems,
  onAddItem,
}: ProductGridProps) {
  const renderProductCard = (product: Product) => {
    const inCart = cartItems.find((i) => i.product.id === product.id);
    const isOutOfStock = product.quantity <= 0;
    const isLowStock = product.quantity > 0 && product.quantity <= product.low_stock_alert;

    return (
      <button
        key={product.id}
        onClick={() => !isOutOfStock && onAddItem(product)}
        disabled={isOutOfStock}
        className={cn(
          'relative text-left w-full p-3 rounded-lg border bg-card transition-all duration-150',
          'hover:border-primary/50 hover:shadow-sm active:scale-[0.98]',
          isOutOfStock && 'opacity-50 cursor-not-allowed',
          inCart && 'ring-2 ring-primary border-primary/30 bg-primary/5'
        )}
      >
        {/* Cart badge */}
        {inCart && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
            {inCart.quantity}
          </div>
        )}

        {/* Product name - truncated */}
        <p className="font-medium text-sm truncate leading-tight">{product.name}</p>
        
        {/* Price and stock row */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="font-bold text-primary text-sm currency">
            {formatCurrency(product.selling_price)}
          </span>
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
              isOutOfStock && 'bg-destructive/10 text-destructive',
              isLowStock && 'bg-warning/20 text-warning',
              !isOutOfStock && !isLowStock && 'bg-muted text-muted-foreground'
            )}
          >
            {isOutOfStock ? 'Out' : product.quantity}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar - no dropdown */}
      <div className="p-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 text-sm bg-background"
          />
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? 'No products found' : 'No products available'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {products.map((product) => renderProductCard(product))}
          </div>
        )}
      </div>
    </div>
  );
}

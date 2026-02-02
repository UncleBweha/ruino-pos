import { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { CartItem } from '@/types/database';

interface CartPanelProps {
  items: CartItem[];
  isAdmin: boolean;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdatePrice: (productId: string, price: number) => boolean;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

export function CartPanel({
  items,
  isAdmin,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
}: CartPanelProps) {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleStartPriceEdit = (productId: string, currentPrice: number) => {
    setEditingPriceId(productId);
    setEditPriceValue(currentPrice.toString());
    setPriceError(null);
  };

  const handleSavePriceEdit = (item: CartItem) => {
    const newPrice = parseFloat(editPriceValue);
    
    if (isNaN(newPrice) || newPrice <= 0) {
      setPriceError('Invalid price');
      return;
    }

    if (newPrice <= item.product.buying_price) {
      setPriceError('Below cost not allowed');
      return;
    }

    onUpdatePrice(item.product.id, newPrice);
    setEditingPriceId(null);
    setEditPriceValue('');
    setPriceError(null);
  };

  const handleCancelPriceEdit = () => {
    setEditingPriceId(null);
    setEditPriceValue('');
    setPriceError(null);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-muted-foreground">Cart is empty</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Tap products to add them</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <span className="font-semibold">Cart</span>
          <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {itemCount}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearCart} className="text-muted-foreground hover:text-destructive">
          Clear
        </Button>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => {
          const isEditing = editingPriceId === item.product.id;
          const isPriceModified = item.unitPrice !== item.product.selling_price;
          const isBelowCost = item.unitPrice <= item.product.buying_price;

          return (
            <div
              key={item.product.id}
              className={cn(
                'px-4 py-3 border-b border-border/50 transition-colors',
                isBelowCost && 'bg-destructive/5'
              )}
            >
              {/* Product name and delete */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm leading-tight flex-1">{item.product.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRemoveItem(item.product.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Price editing or display */}
              {isEditing ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="number"
                    value={editPriceValue}
                    onChange={(e) => {
                      setEditPriceValue(e.target.value);
                      setPriceError(null);
                    }}
                    className={cn(
                      "h-8 w-24 text-sm",
                      priceError && "border-destructive"
                    )}
                    min={0}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePriceEdit(item);
                      else if (e.key === 'Escape') handleCancelPriceEdit();
                    }}
                  />
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSavePriceEdit(item)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCancelPriceEdit}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <button
                    onClick={() => handleStartPriceEdit(item.product.id, item.unitPrice)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted transition-colors',
                      isPriceModified && 'text-warning font-medium',
                      isBelowCost && 'text-destructive'
                    )}
                  >
                    <span className="currency">{formatCurrency(item.unitPrice)}</span>
                    <Edit2 className="w-3 h-3 opacity-50" />
                  </button>
                  <span className="text-muted-foreground">×</span>
                  <span className="text-muted-foreground">{item.quantity}</span>
                  {isPriceModified && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatCurrency(item.product.selling_price)}
                    </span>
                  )}
                </div>
              )}

              {/* Price error */}
              {isEditing && priceError && (
                <div className="flex items-center gap-1 text-xs text-destructive mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  {priceError}
                </div>
              )}

              {/* Below cost warning */}
              {!isEditing && isBelowCost && (
                <div className="flex items-center gap-1 text-xs text-destructive mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  Below buying price not allowed
                </div>
              )}

              {/* Admin: show buying price */}
              {isAdmin && (
                <div className="text-xs text-muted-foreground mb-2">
                  Cost: {formatCurrency(item.product.buying_price)}
                </div>
              )}

              {/* Quantity controls and line total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.quantity}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <span className="font-bold currency">{formatCurrency(item.total)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

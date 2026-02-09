import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/types/database';

interface LowStockCardProps {
  products: Product[];
}

export function LowStockCard({ products }: LowStockCardProps) {
  return (
    <div className="bento-card">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <h3 className="font-bold text-base">Low Stock</h3>
      </div>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">
          All products well stocked ✓
        </p>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 rounded-xl bg-pos-warning"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate max-w-[120px]">
                  {product.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  SKU: {product.sku}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm text-warning">
                  {product.quantity} left
                </p>
                <p className="text-xs text-muted-foreground">
                  Alert: {product.low_stock_alert}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
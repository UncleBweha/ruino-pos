import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/types/database';

interface LowStockCardProps {
  products: Product[];
}

export function LowStockCard({ products }: LowStockCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Low Stock Alert
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            All products well stocked
          </p>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-pos-warning"
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
                  <p className="font-semibold text-sm text-warning">
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
      </CardContent>
    </Card>
  );
}

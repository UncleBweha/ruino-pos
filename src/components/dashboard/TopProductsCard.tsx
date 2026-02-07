import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/constants';
import type { TopProduct } from '@/types/database';

interface TopProductsCardProps {
  products: TopProduct[];
  loading: boolean;
}

export function TopProductsCard({ products, loading }: TopProductsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Top Products</CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            No sales data yet
          </p>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-2 pb-1 border-b">
              <span>Product</span>
              <div className="flex gap-6">
                <span className="w-12 text-right">Qty</span>
                <span className="w-20 text-right">Revenue</span>
              </div>
            </div>
            {products.slice(0, 6).map((product, index) => (
              <div
                key={product.product_name}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium truncate max-w-[120px]">
                    {product.product_name}
                  </p>
                </div>
                <div className="flex gap-6 flex-shrink-0">
                  <span className="w-12 text-right text-sm text-muted-foreground">
                    {product.total_quantity}
                  </span>
                  <span className="w-20 text-right text-sm font-semibold currency">
                    {formatCurrency(product.total_revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

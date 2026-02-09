import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/constants';
import type { TopProduct } from '@/types/database';
import { Award } from 'lucide-react';

interface TopProductsCardProps {
  products: TopProduct[];
  loading: boolean;
}

export function TopProductsCard({ products, loading }: TopProductsCardProps) {
  if (loading) {
    return (
      <div className="bento-card">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <Award className="w-4 h-4 text-accent-foreground" />
        </div>
        <h3 className="font-bold text-base">Top Products</h3>
      </div>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">
          No sales data yet
        </p>
      ) : (
        <div className="space-y-1.5">
          {products.slice(0, 6).map((product, index) => (
            <div
              key={product.product_name}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-foreground text-background text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm font-medium truncate max-w-[120px]">
                  {product.product_name}
                </p>
              </div>
              <div className="flex gap-4 flex-shrink-0 items-center">
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  ×{product.total_quantity}
                </span>
                <span className="text-sm font-bold currency">
                  {formatCurrency(product.total_revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
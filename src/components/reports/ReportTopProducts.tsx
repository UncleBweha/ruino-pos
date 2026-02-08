import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import type { DailyReportData } from '@/hooks/useReports';

interface Props {
  products: DailyReportData['topProducts'];
  loading: boolean;
}

const formatCurrency = (n: number) =>
  `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

export function ReportTopProducts({ products, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 w-full rounded" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" /> Top Selling Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No product data</p>
        ) : (
          <div className="space-y-3">
            {products.map((product, index) => {
              const maxRevenue = products[0]?.total_revenue || 1;
              const percentage = (product.total_revenue / maxRevenue) * 100;
              return (
                <div key={product.product_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-medium truncate max-w-[160px]">{product.product_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold currency">{formatCurrency(product.total_revenue)}</span>
                      <span className="text-xs text-muted-foreground ml-2">({product.total_quantity} sold)</span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

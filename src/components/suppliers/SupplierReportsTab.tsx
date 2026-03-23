import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import { Loader2, TrendingDown, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Supplier } from '@/types/database';

interface Props {
  suppliers: Supplier[];
}

export function SupplierReportsTab({ suppliers }: Props) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('returns_damages').select('*').order('date_returned', { ascending: false }).limit(50);
      setReturns(data || []);
      setLoading(false);
    })();
  }, []);

  // Calculate supplier balances
  const supplierBalances = suppliers.map(s => {
    const products = (s.supplier_products || []) as any[];
    const totalOwed = products.reduce((sum: number, p: any) => sum + p.total_amount, 0);
    const totalPaid = products.filter((p: any) => p.payment_status === 'paid').reduce((sum: number, p: any) => sum + p.total_amount, 0);
    const partialPaid = products.filter((p: any) => p.amount_paid > 0 && p.payment_status !== 'paid').reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
    const balance = totalOwed - totalPaid - partialPaid;
    return { ...s, totalOwed, totalPaid: totalPaid + partialPaid, balance, recordCount: products.length };
  }).filter(s => s.balance > 0).sort((a, b) => b.balance - a.balance);

  // Recent stock received
  const recentStock = suppliers.flatMap(s =>
    ((s.supplier_products || []) as any[]).map(p => ({ ...p, supplierName: s.name }))
  ).sort((a, b) => new Date(b.supplied_at).getTime() - new Date(a.supplied_at).getTime()).slice(0, 20);

  // Returns summary
  const totalReturnQty = returns.reduce((s, r) => s + r.quantity, 0);
  const damagedCount = returns.filter(r => r.type === 'damaged').length;
  const returnedCount = returns.filter(r => r.type === 'returned').length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
          <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(supplierBalances.reduce((s, b) => s + b.balance, 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Suppliers with Balance</p>
          <p className="text-xl font-bold mt-1">{supplierBalances.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Returns</p>
          <p className="text-xl font-bold mt-1">{totalReturnQty} items</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Damaged vs Returned</p>
          <p className="text-xl font-bold mt-1">{damagedCount} / {returnedCount}</p>
        </CardContent></Card>
      </div>

      {/* Outstanding Balances */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5" /> Outstanding Supplier Balances</CardTitle></CardHeader>
        <CardContent>
          {supplierBalances.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No outstanding balances</p>
          ) : (
            <div className="space-y-2">
              {supplierBalances.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.recordCount} records | Total: {formatCurrency(s.totalOwed)} | Paid: {formatCurrency(s.totalPaid)}</p>
                  </div>
                  <p className="text-lg font-bold text-destructive">{formatCurrency(s.balance)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Received Stock */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Recently Received Stock</CardTitle></CardHeader>
        <CardContent>
          {recentStock.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No stock received yet</p>
          ) : (
            <div className="space-y-2">
              {recentStock.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">{p.product_name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{p.supplierName}</span>
                      <span>{format(new Date(p.supplied_at), 'dd MMM yyyy')}</span>
                      <span>Qty: {p.quantity}</span>
                      {p.grn_number && <Badge variant="outline" className="text-xs">{p.grn_number}</Badge>}
                    </div>
                  </div>
                  <p className="font-semibold">{formatCurrency(p.total_amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Returns Summary */}
      {returns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Returns & Damages Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {returns.slice(0, 10).map(r => {
                const sup = suppliers.find(s => s.id === r.supplier_id);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">{r.product_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span>{sup?.name}</span>
                        <span>{format(new Date(r.date_returned), 'dd MMM yyyy')}</span>
                        <span>Qty: {r.quantity}</span>
                        {r.reason && <span>{r.reason}</span>}
                      </div>
                    </div>
                    <Badge variant={r.type === 'damaged' ? 'destructive' : 'secondary'}>{r.type}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

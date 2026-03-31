import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Package,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';

export default function WarehousePage() {
  const { profile } = useAuth();
  const { products, categories, loading, refresh } = useProducts();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferType, setTransferType] = useState<'to_shop' | 'to_warehouse'>('to_shop');
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferLoading, setTransferLoading] = useState(false);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || 
      p.category_id === categoryFilter ||
      (categoryFilter === 'uncategorized' && !p.category_id);
    return matchesSearch && matchesCategory;
  });

  function openTransferForm(product: Product, type: 'to_shop' | 'to_warehouse') {
    setSelectedProduct(product);
    setTransferType(type);
    setTransferQuantity(0);
    setShowTransferForm(true);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct || transferQuantity <= 0) return;

    if (transferType === 'to_shop' && transferQuantity > selectedProduct.warehouse_quantity) {
      toast({ title: 'Insufficient Stock in Warehouse', variant: 'destructive' });
      return;
    }

    if (transferType === 'to_warehouse' && transferQuantity > selectedProduct.quantity) {
      toast({ title: 'Insufficient Stock in Shop', variant: 'destructive' });
      return;
    }

    setTransferLoading(true);
    try {
      const source = transferType === 'to_shop' ? 'warehouse' : 'shop';
      const destination = transferType === 'to_shop' ? 'shop' : 'warehouse';

      const updates = {
        warehouse_quantity: transferType === 'to_shop' 
          ? selectedProduct.warehouse_quantity - transferQuantity 
          : selectedProduct.warehouse_quantity + transferQuantity,
        quantity: transferType === 'to_shop'
          ? selectedProduct.quantity + transferQuantity
          : selectedProduct.quantity - transferQuantity
      };

      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', selectedProduct.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('stock_transfers')
        .insert({
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          source,
          destination,
          quantity: transferQuantity,
          created_by: profile?.full_name || 'System'
        });

      if (logError) throw logError;

      toast({ title: 'Transfer Successful' });
      setShowTransferForm(false);
      refresh();
    } catch (error) {
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTransferLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Warehouse Inventory</h1>
            <p className="text-muted-foreground">Manage and transfer stock between warehouse and shop</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-12">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No products found in Warehouse</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right text-muted-foreground">Shop Qty</TableHead>
                      <TableHead className="text-right">Warehouse Qty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{product.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{product.warehouse_quantity}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTransferForm(product, 'to_shop')}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
                              To Shop
                            </Button>
                            <Button
                              variant="outline"
                              size="sm" 
                              onClick={() => openTransferForm(product, 'to_warehouse')}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
                              To Warehouse
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Transfer {transferType === 'to_shop' ? 'to Shop' : 'to Warehouse'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <div className="font-medium">{selectedProduct?.name}</div>
              <div className="text-sm text-muted-foreground">
                Available in Source: {transferType === 'to_shop' ? selectedProduct?.warehouse_quantity : selectedProduct?.quantity}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quantity to Transfer</Label>
              <Input
                type="number"
                min="1"
                max={transferType === 'to_shop' ? selectedProduct?.warehouse_quantity : selectedProduct?.quantity}
                value={transferQuantity || ''}
                onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 0)}
                placeholder="0"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowTransferForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={transferLoading || transferQuantity <= 0}>
                {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

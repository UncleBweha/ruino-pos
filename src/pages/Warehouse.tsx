import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Package,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronsUpDown,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';
import { cn } from '@/lib/utils';

type TransferType = 'to_shop' | 'to_warehouse';

interface TransferState {
  type: TransferType;
  open: boolean;
}

export default function WarehousePage() {
  const { profile } = useAuth();
  const { products, loading, refresh } = useProducts();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [transfer, setTransfer] = useState<TransferState>({ type: 'to_shop', open: false });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Warehouse view: only products stored in warehouse
  const warehouseProducts = products.filter(p => (p.warehouse_quantity ?? 0) > 0);

  const filteredProducts = warehouseProducts.filter((p) =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Available products for each modal
  const productsForExport = products.filter(p => (p.warehouse_quantity ?? 0) > 0);
  const productsForImport = products.filter(p => (p.quantity ?? 0) > 0);
  const availableProducts = transfer.type === 'to_shop' ? productsForExport : productsForImport;

  function openTransferModal(type: TransferType) {
    setTransfer({ type, open: true });
    setSelectedProduct(null);
    setTransferQuantity('');
    setProductSearchOpen(false);
  }

  function closeTransferModal() {
    setTransfer(prev => ({ ...prev, open: false }));
    setSelectedProduct(null);
    setTransferQuantity('');
  }

  function getAvailableQty(product: Product | null): number {
    if (!product) return 0;
    return transfer.type === 'to_shop'
      ? (product.warehouse_quantity ?? 0)
      : (product.quantity ?? 0);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct || transferQuantity === '' || transferQuantity <= 0) return;

    const available = getAvailableQty(selectedProduct);
    if (transferQuantity > available) {
      const src = transfer.type === 'to_shop' ? 'Warehouse' : 'Shop';
      toast({ title: `Insufficient Stock in ${src}`, variant: 'destructive' });
      return;
    }

    setTransferLoading(true);
    try {
      const source = transfer.type === 'to_shop' ? 'warehouse' : 'shop';
      const destination = transfer.type === 'to_shop' ? 'shop' : 'warehouse';

      const updates = transfer.type === 'to_shop'
        ? {
            warehouse_quantity: (selectedProduct.warehouse_quantity ?? 0) - transferQuantity,
            quantity: (selectedProduct.quantity ?? 0) + transferQuantity,
          }
        : {
            quantity: (selectedProduct.quantity ?? 0) - transferQuantity,
            warehouse_quantity: (selectedProduct.warehouse_quantity ?? 0) + transferQuantity,
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
          quantity: transferQuantity as number,
          created_by: profile?.full_name || 'Admin',
        });

      if (logError) throw logError;

      toast({
        title: 'Transfer Successful',
        description: `${transferQuantity} × ${selectedProduct.name} moved from ${source} → ${destination}`,
      });
      closeTransferModal();
      refresh();
    } catch (error) {
      console.error("Transfer Error Details:", error);
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : JSON.stringify(error),
        variant: 'destructive',
      });
    } finally {
      setTransferLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Warehouse Inventory</h1>
            <p className="text-muted-foreground">
              {warehouseProducts.length} product{warehouseProducts.length !== 1 ? 's' : ''} in warehouse storage
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => openTransferModal('to_shop')} className="gap-2">
              <ArrowUpFromLine className="w-4 h-4" />
              Export to Shop
            </Button>
            <Button variant="outline" onClick={() => openTransferModal('to_warehouse')} className="gap-2">
              <ArrowDownToLine className="w-4 h-4" />
              Import from Shop
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        {/* Warehouse Products Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {searchQuery ? 'No products match your search' : 'No products in Warehouse'}
                </p>
                <p className="text-sm mt-1">
                  {!searchQuery && 'Use "Import from Shop" or receive goods to add stock here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Warehouse Qty</TableHead>
                      <TableHead className="text-right text-muted-foreground">Shop Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {product.sku}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono">
                            {product.warehouse_quantity ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.quantity ?? 0}
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

      {/* Transfer Modal (shared for both directions) */}
      <Dialog open={transfer.open} onOpenChange={closeTransferModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transfer.type === 'to_shop'
                ? '📦 Export to Shop Inventory'
                : '🏭 Import from Shop Inventory'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {transfer.type === 'to_shop'
              ? 'Select a product and quantity to move from Warehouse → Shop.'
              : 'Select a product and quantity to move from Shop → Warehouse.'}
          </p>

          <form onSubmit={handleTransfer} className="space-y-4 pt-2">
            {/* Searchable Product Picker */}
            <div className="space-y-2">
              <Label>
                Product
                <span className="ml-1 text-xs text-muted-foreground">
                  ({availableProducts.length} available)
                </span>
              </Label>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedProduct ? selectedProduct.name : 'Search for a product...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or SKU..." />
                    <CommandList>
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup>
                        {availableProducts.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.name} ${product.sku}`}
                            onSelect={() => {
                              setSelectedProduct(product);
                              setTransferQuantity('');
                              setProductSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedProduct?.id === product.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                SKU: {product.sku} •{' '}
                                {transfer.type === 'to_shop'
                                  ? `Warehouse: ${product.warehouse_quantity ?? 0}`
                                  : `Shop: ${product.quantity ?? 0}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Show available stock info */}
            {selectedProduct && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available in source:</span>
                  <span className="font-medium">
                    {getAvailableQty(selectedProduct)} units
                  </span>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity to Transfer</Label>
              <Input
                type="number"
                min="1"
                max={getAvailableQty(selectedProduct)}
                value={transferQuantity === '' ? '' : transferQuantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setTransferQuantity('');
                  } else {
                    const num = parseInt(val);
                    if (!isNaN(num)) {
                      setTransferQuantity(num);
                    }
                  }
                }}
                placeholder="0"
                required
                disabled={!selectedProduct}
              />
              {selectedProduct && transferQuantity !== '' && transferQuantity > getAvailableQty(selectedProduct) && (
                <p className="text-xs text-destructive">
                  Cannot exceed available quantity ({getAvailableQty(selectedProduct)})
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={closeTransferModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  transferLoading ||
                  !selectedProduct ||
                  transferQuantity === '' ||
                  transferQuantity <= 0 ||
                  transferQuantity > getAvailableQty(selectedProduct)
                }
              >
                {transferLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirm Transfer'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import {
  Search,
  Plus,
  Edit2,
  Package,
  AlertTriangle,
  Loader2,
  X,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';
import { cn } from '@/lib/utils';

interface ProductFormData {
  sku: string;
  name: string;
  category_id: string;
  quantity: number;
  buying_price: number;
  selling_price: number;
  low_stock_alert: number;
}

const emptyForm: ProductFormData = {
  sku: '',
  name: '',
  category_id: '',
  quantity: 0,
  buying_price: 0,
  selling_price: 0,
  low_stock_alert: 10,
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const {
    products,
    categories,
    loading,
    lowStockProducts,
    addProduct,
    updateProduct,
    addCategory,
    refresh,
  } = useProducts();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [productMode, setProductMode] = useState<'new' | 'existing'>('new');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState(0);

  async function handleRestock() {
    if (!selectedProductId || restockQuantity <= 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please select a product and enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    setFormLoading(true);
    try {
      const product = products.find(p => p.id === selectedProductId);
      if (!product) throw new Error('Product not found');

      const newQuantity = product.quantity + restockQuantity;
      await updateProduct(selectedProductId, { quantity: newQuantity });
      
      toast({
        title: 'Stock Updated',
        description: `Added ${restockQuantity} units to ${product.name}`,
      });
      setShowForm(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update stock',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  }

  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  function openAddForm() {
    setEditingProduct(null);
    setFormData(emptyForm);
    setProductMode('new');
    setSelectedProductId('');
    setRestockQuantity(0);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category_id: product.category_id || '',
      quantity: product.quantity,
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      low_stock_alert: product.low_stock_alert,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          ...formData,
          category_id: formData.category_id || null,
        });
        toast({ title: 'Product Updated', description: formData.name });
      } else {
        await addProduct({
          ...formData,
          category_id: formData.category_id || null,
        });
        toast({ title: 'Product Added', description: formData.name });
      }
      setShowForm(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save product',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;

    try {
      await addCategory(newCategoryName.trim());
      toast({ title: 'Category Added', description: newCategoryName });
      setNewCategoryName('');
      setShowCategoryInput(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add category',
        variant: 'destructive',
      });
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">
              {products.length} products • {lowStockProducts.length} low stock
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openAddForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          )}
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-warning/50 bg-pos-warning">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 5).map((p) => (
                  <Badge key={p.id} variant="outline" className="border-warning text-warning">
                    {p.name} ({p.quantity})
                  </Badge>
                ))}
                {lowStockProducts.length > 5 && (
                  <Badge variant="outline">+{lowStockProducts.length - 5} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      {isAdmin && <TableHead className="text-right">Buying</TableHead>}
                      <TableHead className="text-right">Selling</TableHead>
                      {isAdmin && <TableHead className="text-right">Profit</TableHead>}
                      {isAdmin && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const profit = product.selling_price - product.buying_price;
                      const margin = product.buying_price > 0
                        ? (profit / product.buying_price) * 100
                        : 0;
                      const isLowStock = product.quantity <= product.low_stock_alert;

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">
                            {product.sku}
                          </TableCell>
                          <TableCell>
                            {product.category?.name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium',
                                isLowStock && 'text-warning'
                              )}
                            >
                              {product.quantity}
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right currency">
                              {formatCurrency(product.buying_price)}
                            </TableCell>
                          )}
                          <TableCell className="text-right currency font-medium">
                            {formatCurrency(product.selling_price)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <span className="text-success font-medium">
                                {formatCurrency(profit)}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                ({margin.toFixed(0)}%)
                              </span>
                            </TableCell>
                          )}
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditForm(product)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>

          {/* Radio toggle for New vs Existing - only show when adding */}
          {!editingProduct && (
            <RadioGroup
              value={productMode}
              onValueChange={(v) => setProductMode(v as 'new' | 'existing')}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new-product" />
                <Label htmlFor="new-product" className="cursor-pointer">New Product</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing-product" />
                <Label htmlFor="existing-product" className="cursor-pointer">Existing Product</Label>
              </div>
            </RadioGroup>
          )}

          {/* New Product Form */}
          {(productMode === 'new' || editingProduct) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="PRD001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                {showCategoryInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      autoFocus
                    />
                    <Button type="button" size="icon" onClick={handleAddCategory}>
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowCategoryInput(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setShowCategoryInput(true)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Buying Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.buying_price}
                    onChange={(e) =>
                      setFormData({ ...formData, buying_price: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price}
                    onChange={(e) =>
                      setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Low Stock Alert Level</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.low_stock_alert}
                  onChange={(e) =>
                    setFormData({ ...formData, low_stock_alert: parseInt(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={formLoading}>
                  {formLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingProduct ? (
                    'Update'
                  ) : (
                    'Add Product'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Existing Product (Restock) Form */}
          {productMode === 'existing' && !editingProduct && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Product</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product to restock" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku}) - Current: {product.quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity to Add</Label>
                <Input
                  type="number"
                  min="1"
                  value={restockQuantity || ''}
                  onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity to add"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={formLoading || !selectedProductId || restockQuantity <= 0}
                  onClick={handleRestock}
                >
                  {formLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Add Stock'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

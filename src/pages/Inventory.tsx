import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Edit2,
  Package,
  AlertTriangle,
  Loader2,
  X,
  Check,
  ChevronsUpDown,
  List,
  Upload,
  AlertCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import type { Product, SalesReturn } from '@/types/database';
import { cn } from '@/lib/utils';
import { PriceListDialog } from '@/components/inventory/PriceListDialog';
import { BulkExcelImport } from '@/components/inventory/BulkExcelImport';

interface ProductFormData {
  sku: string;
  name: string;
  category_id: string;
  quantity: number;
  destination: 'shop' | 'warehouse';
  buying_price: number;
  selling_price: number;
  low_stock_alert: number;
}

const emptyForm: ProductFormData = {
  sku: '',
  name: '',
  category_id: '',
  quantity: 0,
  destination: 'shop',
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [productMode, setProductMode] = useState<'new' | 'existing'>('new');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState(0);
  const [restockDestination, setRestockDestination] = useState<'shop' | 'warehouse'>('shop');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [showPriceList, setShowPriceList] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Damaged / Returns tab state
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returnsSearch, setReturnsSearch] = useState('');

  useEffect(() => {
    fetchSalesReturns();
  }, []);

  async function fetchSalesReturns() {
    setReturnsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setSalesReturns(data as SalesReturn[]);
      }
    } catch (err) {
      console.error('Failed to fetch sales returns:', err);
    } finally {
      setReturnsLoading(false);
    }
  }

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

      if (restockDestination === 'shop') {
        const newQty = product.quantity + restockQuantity;
        await updateProduct(selectedProductId, { quantity: newQty });
      } else {
        const newWarehouseQty = (product.warehouse_quantity ?? 0) + restockQuantity;
        await updateProduct(selectedProductId, { warehouse_quantity: newWarehouseQty });
      }

      toast({
        title: 'Stock Updated',
        description: `Added ${restockQuantity} units to ${product.name} (${restockDestination === 'shop' ? 'Shop' : 'Warehouse'})`,
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

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' ||
      p.category_id === categoryFilter ||
      (categoryFilter === 'uncategorized' && !p.category_id);
    return matchesSearch && matchesCategory;
  });

  const filteredReturns = salesReturns.filter((r) =>
    !returnsSearch ||
    r.product_name.toLowerCase().includes(returnsSearch.toLowerCase()) ||
    r.reason?.toLowerCase().includes(returnsSearch.toLowerCase())
  );

  function openAddForm() {
    setEditingProduct(null);
    setFormData(emptyForm);
    setProductMode('new');
    setSelectedProductId('');
    setRestockQuantity(0);
    setRestockDestination('shop');
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category_id: product.category_id || '',
      quantity: product.quantity,
      destination: 'shop',
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
        // Destructure out `destination` — it's UI-only, not a DB column
        const { destination: _dest, ...productFields } = formData;
        await updateProduct(editingProduct.id, {
          ...productFields,
          category_id: productFields.category_id || null,
        });
        toast({ title: 'Product Updated', description: formData.name });
      } else {
        const productPayload: any = {
          sku: formData.sku,
          name: formData.name,
          category_id: formData.category_id || null,
          buying_price: formData.buying_price,
          selling_price: formData.selling_price,
          low_stock_alert: formData.low_stock_alert,
          quantity: formData.destination === 'shop' ? formData.quantity : 0,
          warehouse_quantity: formData.destination === 'warehouse' ? formData.quantity : 0,
          damaged_quantity: 0,
        };
        await addProduct(productPayload);
        toast({ title: 'Product Added', description: `${formData.name} → ${formData.destination === 'shop' ? 'Shop' : 'Warehouse'} Inventory` });
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

  function getResolutionBadge(resolution: string | null) {
    if (resolution === 'refund') {
      return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">Refunded</Badge>;
    }
    if (resolution === 'replacement') {
      return <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">Replacement</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 overflow-x-hidden">
        <Tabs defaultValue="products">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">Shop Inventory</h1>
                <p className="text-muted-foreground">
                  {products.length} products · {lowStockProducts.length} low stock · {salesReturns.length} returns
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPriceList(true)}>
                  <List className="w-4 h-4 mr-1" />
                  Price List
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
                      <Upload className="w-4 h-4 mr-1" />
                      Import
                    </Button>
                    <Button size="sm" onClick={openAddForm}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Product
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TabsList className="w-fit">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="damaged" className="gap-2">
                Damaged / Returns
                {salesReturns.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {salesReturns.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ───────────── PRODUCTS TAB ───────────── */}
          <TabsContent value="products" className="space-y-4 mt-0">
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

            {/* Search and Filter */}
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
                  <SelectItem value="all">All Categories ({products.length})</SelectItem>
                  <SelectItem value="uncategorized">
                    Uncategorized ({products.filter(p => !p.category_id).length})
                  </SelectItem>
                  {categories.map((cat) => {
                    const count = products.filter(p => p.category_id === cat.id).length;
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
                  <>
                    {/* Mobile card layout */}
                    <div className="block sm:hidden divide-y divide-border">
                      {filteredProducts.map((product) => {
                        const profit = product.selling_price - product.buying_price;
                        const margin = product.buying_price > 0
                          ? (profit / product.buying_price) * 100
                          : 0;
                        const isLowStock = product.quantity <= product.low_stock_alert;

                        return (
                          <div key={product.id} className="p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={cn(
                                  'text-sm font-medium px-2 py-0.5 rounded-full',
                                  isLowStock ? 'bg-warning/10 text-warning' : 'bg-muted'
                                )}>
                                  {product.quantity} pcs
                                </span>
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(product)}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              {product.category?.name && (
                                <span className="text-muted-foreground text-xs">{product.category.name}</span>
                              )}
                              {isAdmin && (
                                <span className="text-muted-foreground">Buy: {formatCurrency(product.buying_price)}</span>
                              )}
                              <span className="font-medium">Sell: {formatCurrency(product.selling_price)}</span>
                              {isAdmin && (
                                <span className="text-success text-xs">+{formatCurrency(profit)} ({margin.toFixed(0)}%)</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Shop Qty</TableHead>
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
                                  <span className={cn('font-medium', isLowStock && 'text-warning')}>
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
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ───────────── DAMAGED / RETURNS TAB ───────────── */}
          <TabsContent value="damaged" className="space-y-4 mt-0">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Items below are <strong>not included</strong> in sellable shop inventory.
                    They are returned or damaged goods tracked for reference.
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Search Returns */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by product or reason..."
                value={returnsSearch}
                onChange={(e) => setReturnsSearch(e.target.value)}
                className="pl-10 h-11"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                {returnsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredReturns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No returns or damaged items found</p>
                    <p className="text-sm mt-1">Returned items from Sales History will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Resolution</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReturns.map((ret) => (
                          <TableRow key={ret.id}>
                            <TableCell className="font-medium">{ret.product_name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-mono">
                                {ret.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">
                              {ret.reason?.replace('_', ' ') || '—'}
                            </TableCell>
                            <TableCell>
                              {getResolutionBadge(ret.resolution)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(ret.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                              {ret.notes || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ───────────── Add / Edit Product Dialog ───────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>

          {/* Radio toggle for New vs Existing (only when adding) */}
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
                <Label htmlFor="existing-product" className="cursor-pointer">Add Stock (Existing)</Label>
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
                    value={formData.quantity || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                    placeholder="0"
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

              {/* Destination only for new product add */}
              {!editingProduct && (
                <div className="space-y-2">
                  <Label>Initial Stock Destination</Label>
                  <Select
                    value={formData.destination}
                    onValueChange={(v: 'shop' | 'warehouse') => setFormData({ ...formData, destination: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop Inventory</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                    value={formData.buying_price || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, buying_price: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Low Stock Alert Level</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.low_stock_alert || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, low_stock_alert: parseInt(e.target.value) || 0 })
                  }
                  placeholder="10"
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

          {/* Existing Product (Add Stock) Form */}
          {productMode === 'existing' && !editingProduct && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Product</Label>
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedProductId
                        ? products.find((p) => p.id === selectedProductId)?.name
                        : 'Search for a product...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name or SKU..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.name} ${product.sku}`}
                              onSelect={() => {
                                setSelectedProductId(product.id);
                                setProductSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedProductId === product.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  SKU: {product.sku} · Shop: {product.quantity} · WH: {product.warehouse_quantity ?? 0}
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

              <div className="space-y-2">
                <Label>Add to</Label>
                <Select
                  value={restockDestination}
                  onValueChange={(v: 'shop' | 'warehouse') => setRestockDestination(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shop">Shop Inventory</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
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

      <PriceListDialog
        open={showPriceList}
        onOpenChange={setShowPriceList}
        products={products}
        categories={categories}
      />

      <BulkExcelImport
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        categories={categories}
        onSuccess={refresh}
      />
    </AppLayout>
  );
}

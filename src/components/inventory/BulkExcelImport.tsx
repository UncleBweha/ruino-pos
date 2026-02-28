import { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, FileSpreadsheet, AlertCircle, Trash2, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/types/database';

interface BulkExcelImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSuccess: () => void;
}

interface ParsedProduct {
  sku: string;
  name: string;
  quantity: number;
  buying_price: number;
  selling_price: number;
  low_stock_alert: number;
  category_id: string | null;
}

export function BulkExcelImport({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: BulkExcelImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerInProgressRef = useRef(false);
  const filePickerResetTimerRef = useRef<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (filePickerResetTimerRef.current) {
        window.clearTimeout(filePickerResetTimerRef.current);
      }
    };
  }, []);

  function openFilePicker() {
    filePickerInProgressRef.current = true;

    if (filePickerResetTimerRef.current) {
      window.clearTimeout(filePickerResetTimerRef.current);
      filePickerResetTimerRef.current = null;
    }

    const clearFilePickerLock = () => {
      filePickerInProgressRef.current = false;

      if (filePickerResetTimerRef.current) {
        window.clearTimeout(filePickerResetTimerRef.current);
        filePickerResetTimerRef.current = null;
      }
    };

    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(clearFilePickerLock, 0);
      },
      { once: true }
    );

    filePickerResetTimerRef.current = window.setTimeout(clearFilePickerLock, 10000);
    fileInputRef.current?.click();
  }

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          setParseErrors(['File must have a header row and at least one data row']);
          return;
        }

        // Detect columns from header with robust matching
        const header = rows[0].map((h: any) => String(h ?? '').toLowerCase().trim());
        
        // Helper: find column index with priority keywords, excluding already-used indices
        function findCol(tests: ((h: string) => boolean)[], exclude: number[] = []): number {
          for (const test of tests) {
            const idx = header.findIndex((h: string, i: number) => !exclude.includes(i) && test(h));
            if (idx !== -1) return idx;
          }
          return -1;
        }

        const skuCol = findCol([
          h => h === 'sku',
          h => h.includes('sku') || h.includes('code'),
        ]);
        const nameCol = findCol([
          h => h.includes('product name') || h.includes('product_name'),
          h => h.includes('name') || h.includes('product'),
        ], [skuCol]);
        const qtyCol = findCol([
          h => h.includes('qty') || h.includes('quantity') || h.includes('stock'),
        ]);
        const buyCol = findCol([
          h => h.includes('buying') || h.includes('buy') || h.includes('cost'),
        ]);
        const sellCol = findCol([
          h => h.includes('selling') || h.includes('sell'),
          h => h.includes('price') && !h.includes('buy') && !h.includes('cost'),
        ], [buyCol]);
        const alertCol = findCol([
          h => h.includes('alert') || h.includes('low') || h.includes('reorder'),
        ]);

        const colMap = {
          sku: skuCol,
          name: nameCol,
          quantity: qtyCol,
          buying_price: buyCol,
          selling_price: sellCol,
          low_stock_alert: alertCol,
        };

        if (colMap.sku === -1 || colMap.name === -1) {
          setParseErrors([
            'Could not find required columns. Ensure your Excel has columns for SKU (or Code) and Name (or Product).',
            `Detected headers: ${header.join(', ')}`,
          ]);
          return;
        }

        const products: ParsedProduct[] = [];
        const errors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row.every((c: any) => !c && c !== 0)) continue;

          const sku = String(row[colMap.sku] ?? '').trim();
          const name = String(row[colMap.name] ?? '').trim();

          if (!sku || !name) {
            errors.push(`Row ${i + 1}: SKU and Name are required`);
            continue;
          }

          const quantity = colMap.quantity >= 0 ? (parseInt(row[colMap.quantity]) || 0) : 0;
          const buying_price = colMap.buying_price >= 0 ? (parseFloat(row[colMap.buying_price]) || 0) : 0;
          const selling_price = colMap.selling_price >= 0 ? (parseFloat(row[colMap.selling_price]) || 0) : 0;
          const low_stock_alert = colMap.low_stock_alert >= 0 ? (parseInt(row[colMap.low_stock_alert]) || 10) : 10;

          if (buying_price < 0 || selling_price < 0 || quantity < 0) {
            errors.push(`Row ${i + 1}: Prices and quantity must be positive`);
            continue;
          }

          products.push({
            sku,
            name,
            quantity,
            buying_price,
            selling_price,
            low_stock_alert,
            category_id: defaultCategory || null,
          });
        }

        if (errors.length > 0) {
          setParseErrors(errors);
        }

        setParsedProducts(products);
      } catch (err) {
        setParseErrors(['Failed to parse Excel file. Please check the format.']);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    filePickerInProgressRef.current = false;

    if (filePickerResetTimerRef.current) {
      window.clearTimeout(filePickerResetTimerRef.current);
      filePickerResetTimerRef.current = null;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseErrors([]);
    setParsedProducts([]);
    parseExcel(file);
  }

  function handleDialogOpenChange(isOpen: boolean) {
    if (!isOpen && filePickerInProgressRef.current) {
      return;
    }

    handleClose(isOpen);
  }

  function removeProduct(index: number) {
    setParsedProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (parsedProducts.length === 0) return;

    setLoading(true);
    setParseErrors([]);

    try {
      // Apply default category to all products
      const effectiveCategory = defaultCategory && defaultCategory !== 'none' ? defaultCategory : null;
      const productsToInsert = parsedProducts.map((p) => ({
        ...p,
        category_id: effectiveCategory,
      }));

      const { error } = await supabase.from('products').insert(productsToInsert);

      if (error) throw error;

      toast({
        title: 'Products Imported',
        description: `Successfully imported ${productsToInsert.length} products`,
      });

      handleClose(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setFileName('');
      setParsedProducts([]);
      setDefaultCategory('');
      setParseErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Import from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx, .xls) with your product data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format info */}
          <div className="glass-item rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Required Columns</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.aoa_to_sheet([
                    ['SKU', 'Product Name', 'Quantity', 'Buying Price', 'Selling Price', 'Low Stock Alert'],
                    ['SKU001', 'Rice 5kg', 100, 450, 550, 10],
                    ['SKU002', 'Sugar 2kg', 50, 180, 220, 15],
                  ]);
                  ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
                  XLSX.utils.book_append_sheet(wb, ws, 'Products');
                  XLSX.writeFile(wb, 'product_import_template.xlsx');
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                Download Template
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your Excel file should have these column headers (case-insensitive):
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {['SKU / Code', 'Name / Product', 'Qty / Quantity', 'Buying / Cost', 'Selling / Price', 'Alert / Reorder (optional)'].map((col) => (
                <span key={col} className="text-xs bg-muted px-2 py-1 rounded">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Excel File</Label>
            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={openFilePicker}
              >
                <Upload className="w-4 h-4 mr-2" />
                {fileName || 'Choose Excel file'}
              </Button>
              {fileName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFileName('');
                    setParsedProducts([]);
                    setParseErrors([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Default category */}
          <div className="space-y-2">
            <Label>Default Category (optional)</Label>
            <Select value={defaultCategory} onValueChange={setDefaultCategory}>
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Parsing errors:</div>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>...and {parseErrors.length - 5} more errors</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview table */}
          {parsedProducts.length > 0 && (
            <div className="space-y-2">
              <Label>{parsedProducts.length} products found</Label>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Buying</TableHead>
                      <TableHead className="text-right">Selling</TableHead>
                      <TableHead className="text-right">Alert</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">{p.buying_price}</TableCell>
                        <TableCell className="text-right">{p.selling_price}</TableCell>
                        <TableCell className="text-right">{p.low_stock_alert}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(i)}
                            className="h-7 w-7"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleImport}
              disabled={loading || parsedProducts.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import {parsedProducts.length} Products
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

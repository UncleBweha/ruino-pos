import { useState } from 'react';
import { Upload, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/types/database';

interface BulkProductImportProps {
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

export function BulkProductImport({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: BulkProductImportProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const exampleCSV = `SKU001,Rice 5kg,100,450,550,10
SKU002,Sugar 2kg,50,180,220,15
SKU003,Cooking Oil 1L,75,250,300,20`;

  function parseCSV(text: string): { products: ParsedProduct[]; errors: string[] } {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const products: ParsedProduct[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length < 5) {
        errors.push(`Line ${index + 1}: Not enough columns (need at least SKU, Name, Qty, Buying, Selling)`);
        return;
      }

      const [sku, name, quantityStr, buyingStr, sellingStr, alertStr] = parts;

      if (!sku || !name) {
        errors.push(`Line ${index + 1}: SKU and Name are required`);
        return;
      }

      const quantity = parseInt(quantityStr) || 0;
      const buying_price = parseFloat(buyingStr) || 0;
      const selling_price = parseFloat(sellingStr) || 0;
      const low_stock_alert = parseInt(alertStr) || 10;

      if (buying_price < 0 || selling_price < 0 || quantity < 0) {
        errors.push(`Line ${index + 1}: Prices and quantity must be positive`);
        return;
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
    });

    return { products, errors };
  }

  async function handleImport() {
    if (!csvData.trim()) {
      toast({
        title: 'No Data',
        description: 'Please paste product data to import',
        variant: 'destructive',
      });
      return;
    }

    const { products, errors } = parseCSV(csvData);
    
    if (errors.length > 0) {
      setParseErrors(errors);
      return;
    }

    if (products.length === 0) {
      toast({
        title: 'No Valid Products',
        description: 'No valid products found in the data',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setParseErrors([]);

    try {
      const { error } = await supabase
        .from('products')
        .insert(products);

      if (error) throw error;

      toast({
        title: 'Products Imported',
        description: `Successfully imported ${products.length} products`,
      });

      setCsvData('');
      setDefaultCategory('');
      onOpenChange(false);
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
      setCsvData('');
      setDefaultCategory('');
      setParseErrors([]);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Paste CSV data to import multiple products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4" />
              CSV Format
            </div>
            <p className="text-xs text-muted-foreground">
              Each line: SKU, Name, Quantity, Buying Price, Selling Price, Low Stock Alert (optional)
            </p>
            <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
              {exampleCSV}
            </pre>
          </div>

          {/* Default category */}
          <div className="space-y-2">
            <Label>Default Category (optional)</Label>
            <Select value={defaultCategory} onValueChange={setDefaultCategory}>
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CSV input */}
          <div className="space-y-2">
            <Label>Product Data</Label>
            <Textarea
              value={csvData}
              onChange={(e) => {
                setCsvData(e.target.value);
                setParseErrors([]);
              }}
              placeholder="Paste your CSV data here..."
              className="min-h-[200px] font-mono text-sm"
            />
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
              disabled={loading || !csvData.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Products
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

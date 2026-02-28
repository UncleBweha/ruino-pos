import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useSettings } from '@/hooks/useSettings';
import { generatePDFFromHTML, printHTML } from '@/lib/pdfUtils';
import type { Product, Category, ReceiptSettings } from '@/types/database';

interface PriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: Category[];
}

function buildPriceListHTML(
  products: Product[],
  categories: Category[],
  settings: ReceiptSettings | null,
) {
  const companyName = settings?.company_name || 'Ruinu General Merchants';
  const phone = settings?.phone;
  const email = settings?.email;
  const address = settings?.address;
  const building = settings?.building;
  const website = settings?.website;
  const taxPin = settings?.tax_pin;
  const logoUrl = settings?.logo_url;
  // Group products by category
  const grouped = new Map<string, Product[]>();
  const uncategorized: Product[] = [];

  for (const p of products) {
    if (p.category_id) {
      const cat = categories.find((c) => c.id === p.category_id);
      const catName = cat?.name || 'Other';
      if (!grouped.has(catName)) grouped.set(catName, []);
      grouped.get(catName)!.push(p);
    } else {
      uncategorized.push(p);
    }
  }

  // Sort categories alphabetically
  const sortedCategories = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (uncategorized.length > 0) sortedCategories.push(['Other', uncategorized]);

  const now = new Date().toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let rows = '';
  let counter = 0;

  for (const [catName, items] of sortedCategories) {
    rows += `<tr><td colspan="3" style="background:#f3f4f6;font-weight:700;padding:8px 12px;font-size:13px;border-top:2px solid #e5e7eb;">${catName}</td></tr>`;
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const p of sorted) {
      counter++;
      const bg = counter % 2 === 0 ? '#fafafa' : '#fff';
      rows += `<tr style="background:${bg}">
        <td style="padding:6px 12px;font-size:13px;">${p.name}</td>
        <td style="padding:6px 12px;font-size:13px;color:#6b7280;">${p.sku}</td>
        <td style="padding:6px 12px;font-size:13px;text-align:right;font-weight:600;">${formatCurrency(p.selling_price)}</td>
      </tr>`;
    }
  }

  const contactParts: string[] = [];
  if (address) contactParts.push(address);
  if (building) contactParts.push(building);
  if (phone) contactParts.push(`Tel: ${phone}`);
  if (email) contactParts.push(email);
  if (website) contactParts.push(website);
  if (taxPin) contactParts.push(`PIN: ${taxPin}`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:30px;color:#1f2937;}
  table{width:100%;border-collapse:collapse;margin-top:16px;}
  th{background:#111827;color:#fff;padding:10px 12px;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;}
  th:last-child{text-align:right;}
</style></head><body>
  <div style="text-align:center;margin-bottom:20px;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:120px;max-width:300px;margin:0 auto 12px;display:block;" />` : ''}
    <h1 style="margin:0;font-size:22px;">${companyName}</h1>
    ${contactParts.length > 0 ? `<p style="margin:6px 0;color:#6b7280;font-size:12px;line-height:1.6;">${contactParts.join(' &bull; ')}</p>` : ''}
    <h2 style="margin:14px 0 4px;font-size:16px;font-weight:600;">Product Price List</h2>
    <p style="margin:0;color:#9ca3af;font-size:12px;">Updated: ${now}</p>
  </div>
  <table>
    <thead><tr><th>Product</th><th>SKU</th><th>Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">Prices are subject to change without notice.</p>
</body></html>`;
}

export function PriceListDialog({ open, onOpenChange, products, categories }: PriceListDialogProps) {
  const { receiptSettings } = useSettings();
  const [downloading, setDownloading] = useState(false);

  const companyName = receiptSettings?.company_name || 'Ruinu General Merchants';
  const phone = receiptSettings?.phone;

  // Only show in-stock products, sorted by name
  const availableProducts = products
    .filter((p) => p.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const html = buildPriceListHTML(availableProducts, categories, companyName, phone);

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      await generatePDFFromHTML(html, `Price-List-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    printHTML(html);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Product Price List</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownloadPDF} size="sm" disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download PDF
          </Button>
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {availableProducts.length} items in stock
          </span>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg">
          <iframe
            srcDoc={html}
            className="w-full h-full min-h-[400px] border-0"
            title="Price List Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

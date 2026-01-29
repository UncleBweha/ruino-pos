import type { Sale, SaleItem } from '@/types/database';
import { formatCurrency } from '@/lib/constants';

interface ReceiptSettings {
  company_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tax_pin?: string | null;
  footer_text?: string | null;
}

export function printThermalReceipt(
  sale: Sale,
  settings: ReceiptSettings | null
) {
  const companyName = settings?.company_name || 'Ruino General Merchants';
  const phone = settings?.phone || '';
  const address = settings?.address || '';
  const taxPin = settings?.tax_pin || '';
  const footerText = settings?.footer_text || 'Thank you for shopping with us!';

  const saleDate = new Date(sale.created_at).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const items = sale.sale_items || [];

  // Build receipt HTML for thermal printer (80mm width)
  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${sale.receipt_number}</title>
      <style>
        @page {
          margin: 0;
          size: 80mm auto;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          width: 80mm;
          padding: 4mm;
          color: #000;
          background: #fff;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .company-name {
          font-size: 16px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .receipt-info {
          margin: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
        }
        .items-table {
          width: 100%;
          margin: 8px 0;
        }
        .item-row {
          margin-bottom: 4px;
        }
        .item-name {
          font-weight: bold;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          padding-left: 8px;
          font-size: 11px;
        }
        .totals {
          margin-top: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .grand-total {
          font-size: 14px;
          font-weight: bold;
          border-top: 2px solid #000;
          padding-top: 4px;
          margin-top: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-size: 11px;
        }
        .payment-badge {
          display: inline-block;
          padding: 2px 8px;
          border: 1px solid #000;
          margin-top: 8px;
          text-transform: uppercase;
          font-size: 10px;
        }
        @media print {
          body { width: 80mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${companyName}</div>
        ${address ? `<div>${address}</div>` : ''}
        ${phone ? `<div>Tel: ${phone}</div>` : ''}
        ${taxPin ? `<div>PIN: ${taxPin}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <div class="receipt-info">
        <div class="row">
          <span>Receipt:</span>
          <span class="bold">${sale.receipt_number}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${saleDate}</span>
        </div>
        ${sale.customer_name ? `
        <div class="row">
          <span>Customer:</span>
          <span>${sale.customer_name}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="divider"></div>
      
      <div class="items-table">
        ${items.map((item: SaleItem) => `
          <div class="item-row">
            <div class="item-name">${item.product_name}</div>
            <div class="item-details">
              <span>${item.quantity} x ${formatCurrency(item.unit_price)}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="divider"></div>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(sale.subtotal)}</span>
        </div>
        ${sale.tax_amount > 0 ? `
        <div class="total-row">
          <span>Tax (${sale.tax_rate}%):</span>
          <span>${formatCurrency(sale.tax_amount)}</span>
        </div>
        ` : ''}
        ${sale.discount > 0 ? `
        <div class="total-row">
          <span>Discount:</span>
          <span>-${formatCurrency(sale.discount)}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${formatCurrency(sale.total)}</span>
        </div>
      </div>
      
      <div class="center">
        <div class="payment-badge">${sale.payment_method.toUpperCase()}</div>
      </div>
      
      <div class="divider"></div>
      
      <div class="footer">
        <div>${footerText}</div>
        <div style="margin-top: 8px; font-size: 10px;">
          *** ${sale.receipt_number} ***
        </div>
      </div>
    </body>
    </html>
  `;

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(receiptHTML);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Clean up after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  }
}

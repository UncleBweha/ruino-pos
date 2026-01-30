import { formatCurrency } from './constants';
import type { Sale, ReceiptSettings } from '@/types/database';
import { format } from 'date-fns';

interface PrintReceiptOptions {
  sale: Sale;
  settings: ReceiptSettings | null;
}

export function generateReceiptHTML(options: PrintReceiptOptions): string {
  const { sale, settings } = options;

  const companyName = settings?.company_name || 'Ruinu General Merchants';
  const phone = settings?.phone || '';
  const email = settings?.email || '';
  const address = settings?.address || '';
  const taxPin = settings?.tax_pin || '';
  const footerText = settings?.footer_text || 'Thank you for shopping with us!';

  const items = sale.sale_items || [];

  const itemsHTML = items
    .map(
      (item) => `
        <tr>
          <td style="text-align: left; padding: 2px 0;">${item.product_name}</td>
          <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
          <td style="text-align: right; padding: 2px 0;">${formatCurrency(item.unit_price)}</td>
          <td style="text-align: right; padding: 2px 0;">${formatCurrency(item.total)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt - ${sale.receipt_number}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.4;
          width: 80mm;
          padding: 8mm;
          background: white;
          color: black;
        }
        .header {
          text-align: center;
          margin-bottom: 12px;
          border-bottom: 1px dashed #000;
          padding-bottom: 12px;
        }
        .company-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .company-info {
          font-size: 10px;
          line-height: 1.3;
        }
        .receipt-info {
          margin: 12px 0;
          font-size: 11px;
        }
        .receipt-info div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 11px;
        }
        .items-table th {
          border-bottom: 1px dashed #000;
          padding: 4px 0;
          text-align: left;
          font-weight: bold;
        }
        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4) {
          text-align: right;
        }
        .items-table th:nth-child(2) {
          text-align: center;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .totals {
          font-size: 11px;
        }
        .totals div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .grand-total {
          font-size: 14px;
          font-weight: bold;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 6px 0;
          margin: 8px 0;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px dashed #000;
        }
        .payment-method {
          text-transform: uppercase;
          font-weight: bold;
        }
        @media print {
          body {
            width: 80mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${companyName}</div>
        <div class="company-info">
          ${address ? `<div>${address}</div>` : ''}
          ${phone ? `<div>Tel: ${phone}</div>` : ''}
          ${email ? `<div>${email}</div>` : ''}
          ${taxPin ? `<div>PIN: ${taxPin}</div>` : ''}
        </div>
      </div>

      <div class="receipt-info">
        <div>
          <span>Receipt #:</span>
          <span><strong>${sale.receipt_number}</strong></span>
        </div>
        <div>
          <span>Date:</span>
          <span>${format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</span>
        </div>
        ${sale.customer_name ? `
        <div>
          <span>Customer:</span>
          <span>${sale.customer_name}</span>
        </div>
        ` : ''}
        <div>
          <span>Payment:</span>
          <span class="payment-method">${sale.payment_method}</span>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="totals">
        <div>
          <span>Subtotal:</span>
          <span>${formatCurrency(sale.subtotal)}</span>
        </div>
        ${sale.tax_amount > 0 ? `
        <div>
          <span>Tax (${sale.tax_rate}%):</span>
          <span>${formatCurrency(sale.tax_amount)}</span>
        </div>
        ` : ''}
        ${sale.discount > 0 ? `
        <div>
          <span>Discount:</span>
          <span>-${formatCurrency(sale.discount)}</span>
        </div>
        ` : ''}
      </div>

      <div class="grand-total">
        <div style="display: flex; justify-content: space-between;">
          <span>TOTAL:</span>
          <span>${formatCurrency(sale.total)}</span>
        </div>
      </div>

      <div class="footer">
        <p>${footerText}</p>
        <p style="margin-top: 8px; font-size: 9px;">
          ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
        </p>
      </div>
    </body>
    </html>
  `;
}

export function printReceipt(options: PrintReceiptOptions): void {
  const html = generateReceiptHTML(options);

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.left = '-9999px';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to load then print
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    // Remove iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

export function downloadReceipt(options: PrintReceiptOptions): void {
  const html = generateReceiptHTML(options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${options.sale.receipt_number}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

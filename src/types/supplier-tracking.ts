// Supplier tracking types

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supply_record_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface ReturnDamage {
  id: string;
  supplier_id: string;
  supply_record_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  type: 'returned' | 'damaged';
  reason: string | null;
  resolution: string | null;
  date_returned: string;
  stock_adjusted: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface SupplierProductExtended {
  id: string;
  supplier_id: string;
  product_name: string;
  quantity: number;
  buying_price: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  batch_reference: string | null;
  grn_number: string | null;
  product_id: string | null;
  supplied_at: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface SupplierLedgerSummary {
  totalSupplied: number;
  totalPaid: number;
  totalBalance: number;
  totalReturns: number;
  recordCount: number;
}

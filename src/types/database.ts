// Database types for the POS system
export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'cashier';
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  quantity: number;
  buying_price: number;
  selling_price: number;
  low_stock_alert: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Sale {
  id: string;
  receipt_number: string;
  cashier_id: string;
  customer_name: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  profit: number;
  payment_method: 'cash' | 'mpesa' | 'credit';
  status: 'completed' | 'voided' | 'credit';
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  cashier?: Profile;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  buying_price: number;
  total: number;
  profit: number;
  created_at: string;
  product?: Product;
}

export interface Credit {
  id: string;
  sale_id: string;
  customer_name: string;
  total_owed: number;
  amount_paid: number;
  balance: number;
  status: 'pending' | 'paid' | 'returned';
  paid_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  sale?: Sale;
}

export interface CashBox {
  id: string;
  sale_id: string | null;
  amount: number;
  transaction_type: 'sale' | 'credit_payment' | 'adjustment';
  description: string | null;
  cashier_id: string;
  created_at: string;
  cashier?: Profile;
}

export interface ReceiptSettings {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_pin: string | null;
  logo_url: string | null;
  footer_text: string | null;
  updated_at: string;
}

// Cart types
export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number; // Can be adjusted by cashier (must be > buying_price)
  total: number;
  profit: number;
}

// Analytics types
export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  monthSales: number;
  monthProfit: number;
  totalProducts: number;
  lowStockCount: number;
  pendingCredits: number;
  todayCash: number;
  inventoryCost: number;
}

export interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

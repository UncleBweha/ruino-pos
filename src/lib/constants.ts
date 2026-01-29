// Currency formatting for Kenya Shillings
export const CURRENCY = {
  code: 'KES',
  symbol: 'Kshs',
  locale: 'en-KE',
};

export function formatCurrency(amount: number): string {
  return `${CURRENCY.symbol} ${amount.toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString(CURRENCY.locale);
}

// Payment methods
export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: 'Banknote' },
  { id: 'mpesa', label: 'M-Pesa', icon: 'Smartphone' },
  { id: 'credit', label: 'Credit', icon: 'CreditCard' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['id'];

// Sale status
export const SALE_STATUSES = {
  completed: { label: 'Completed', color: 'success' },
  voided: { label: 'Voided', color: 'destructive' },
  credit: { label: 'Credit', color: 'warning' },
} as const;

export type SaleStatus = keyof typeof SALE_STATUSES;

// Credit status
export const CREDIT_STATUSES = {
  pending: { label: 'Pending', color: 'warning' },
  paid: { label: 'Paid', color: 'success' },
  returned: { label: 'Returned', color: 'muted' },
} as const;

export type CreditStatus = keyof typeof CREDIT_STATUSES;

// User roles
export const USER_ROLES = {
  admin: { label: 'Admin', permissions: ['dashboard', 'inventory', 'sales', 'credits', 'settings', 'cashbox', 'void'] },
  cashier: { label: 'Cashier', permissions: ['pos', 'own_sales', 'credits_create'] },
} as const;

export type UserRole = keyof typeof USER_ROLES;

// Default tax rate
export const DEFAULT_TAX_RATE = 0;

// Low stock threshold
export const DEFAULT_LOW_STOCK_ALERT = 10;

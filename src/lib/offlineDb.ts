/**
 * IndexedDB-based offline storage for POS operations.
 * Caches products locally and queues sales for sync when back online.
 */

const DB_NAME = 'ruinu-pos-offline';
const DB_VERSION = 2;

const STORES = {
  products: 'products',
  categories: 'categories',
  customers: 'customers',
  invoices: 'invoices',
  suppliers: 'suppliers',
  settings: 'settings',
  sales: 'sales',
  cashBox: 'cash_box',
  credits: 'credits',
  profiles: 'profiles',
  pendingSales: 'pending_sales',
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === STORES.pendingSales) {
            db.createObjectStore(storeName, { keyPath: 'offlineId', autoIncrement: true });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Generic caching helpers ──

async function cacheEntity(storeName: string, data: any[] | any): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  // Clear and update
  store.clear();
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    if (item && (item.id || storeName === STORES.settings)) {
      // settings might not have a stable ID or might use a dummy id
      store.put(item);
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getCachedEntity(storeName: string): Promise<any[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Specialized exports ──

export const cacheProducts = (data: any[]) => cacheEntity(STORES.products, data);
export const getCachedProducts = () => getCachedEntity(STORES.products);

export const cacheCategories = (data: any[]) => cacheEntity(STORES.categories, data);
export const getCachedCategories = () => getCachedEntity(STORES.categories);

export const cacheCustomers = (data: any[]) => cacheEntity(STORES.customers, data);
export const getCachedCustomers = () => getCachedEntity(STORES.customers);

export const cacheInvoices = (data: any[]) => cacheEntity(STORES.invoices, data);
export const getCachedInvoices = () => getCachedEntity(STORES.invoices);

export const cacheSuppliers = (data: any[]) => cacheEntity(STORES.suppliers, data);
export const getCachedSuppliers = () => getCachedEntity(STORES.suppliers);

export const cacheSettings = (data: any) => cacheEntity(STORES.settings, data);
export async function getCachedSettings(): Promise<any | null> {
  const all = await getCachedEntity(STORES.settings);
  return all.length > 0 ? all[0] : null;
}

export const cacheSales = (data: any[]) => cacheEntity(STORES.sales, data);
export const getCachedSales = () => getCachedEntity(STORES.sales);

export const cacheCashBox = (data: any[]) => cacheEntity(STORES.cashBox, data);
export const getCachedCashBox = () => getCachedEntity(STORES.cashBox);

export const cacheCredits = (data: any[]) => cacheEntity(STORES.credits, data);
export const getCachedCredits = () => getCachedEntity(STORES.credits);

export const cacheProfiles = (data: any[]) => cacheEntity(STORES.profiles, data);
export const getCachedProfiles = () => getCachedEntity(STORES.profiles);

// ── Pending sales queue ──

export interface PendingSale {
  offlineId?: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    buyingPrice: number;
    total: number;
    profit: number;
  }>;
  customerName?: string;
  customerId?: string;
  taxRate: number;
  discount: number;
  paymentMethod: 'cash' | 'mpesa' | 'credit';
  soldOnBehalfOf?: string | null;
  soldOnBehalfName?: string | null;
  commissionAmount?: number;
  createdAt: string;
  cashierId: string;
  cashierName?: string;
  // Offline receipt number (temporary)
  offlineReceipt: string;
}

export async function queueSale(sale: Omit<PendingSale, 'offlineId'>): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingSales, 'readwrite');
  const store = tx.objectStore(STORES.pendingSales);
  const req = store.add(sale);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingSales, 'readonly');
  const store = tx.objectStore(STORES.pendingSales);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingSale(offlineId: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingSales, 'readwrite');
  const store = tx.objectStore(STORES.pendingSales);
  store.delete(offlineId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSalesCount(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingSales, 'readonly');
  const store = tx.objectStore(STORES.pendingSales);
  const req = store.count();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

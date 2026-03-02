/**
 * IndexedDB-based offline storage for POS operations.
 * Caches products locally, queues sales and entity operations for sync when back online.
 */

const DB_NAME = 'ruinu-pos-offline';
const DB_VERSION = 4;

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
  casuals: 'casuals',
  pendingOps: 'pending_ops',
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === STORES.pendingSales || storeName === STORES.pendingOps) {
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
    if (item && (item.id || item.user_id || storeName === STORES.settings)) {
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

// ── Add a single item to a cached store (without clearing) ──

async function addToCachedEntity(storeName: string, item: any): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Specialized exports ──

export const cacheProducts = (data: any[]) => cacheEntity(STORES.products, data);
export const getCachedProducts = () => getCachedEntity(STORES.products);
export const addCachedProduct = (item: any) => addToCachedEntity(STORES.products, item);

export const cacheCategories = (data: any[]) => cacheEntity(STORES.categories, data);
export const getCachedCategories = () => getCachedEntity(STORES.categories);

export const cacheCustomers = (data: any[]) => cacheEntity(STORES.customers, data);
export const getCachedCustomers = () => getCachedEntity(STORES.customers);
export const addCachedCustomer = (item: any) => addToCachedEntity(STORES.customers, item);

export const cacheInvoices = (data: any[]) => cacheEntity(STORES.invoices, data);
export const getCachedInvoices = () => getCachedEntity(STORES.invoices);

export const cacheSuppliers = (data: any[]) => cacheEntity(STORES.suppliers, data);
export const getCachedSuppliers = () => getCachedEntity(STORES.suppliers);
export const addCachedSupplier = (item: any) => addToCachedEntity(STORES.suppliers, item);

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

export const cacheCasuals = (data: any[]) => cacheEntity(STORES.casuals, data);
export const getCachedCasuals = () => getCachedEntity(STORES.casuals);
export const addCachedCasual = (item: any) => addToCachedEntity(STORES.casuals, item);

// ── Local stock helpers (for offline stock tracking) ──

export async function decrementCachedStock(productId: string, quantity: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.products, 'readwrite');
  const store = tx.objectStore(STORES.products);
  const req = store.get(productId);

  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const product = req.result;
      if (product) {
        product.quantity = Math.max(0, product.quantity - quantity);
        store.put(product);
      }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

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
  paymentMethod: 'cash' | 'mpesa' | 'till' | 'cheque' | 'credit';
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

// ── Pending operations queue (generic offline creates) ──

export type PendingOpType = 'create_customer' | 'create_supplier' | 'create_casual' | 'create_product' | 'create_category' | 'add_stock' | 'update_entity' | 'delete_entity';

export interface PendingOp {
  offlineId?: number;
  type: PendingOpType;
  payload: any;
  createdAt: string;
  /** Temporary local ID assigned to the entity */
  tempId: string;
}

export async function queueOp(op: Omit<PendingOp, 'offlineId'>): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingOps, 'readwrite');
  const store = tx.objectStore(STORES.pendingOps);
  const req = store.add(op);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingOps, 'readonly');
  const store = tx.objectStore(STORES.pendingOps);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingOp(offlineId: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingOps, 'readwrite');
  const store = tx.objectStore(STORES.pendingOps);
  store.delete(offlineId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOpsCount(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORES.pendingOps, 'readonly');
  const store = tx.objectStore(STORES.pendingOps);
  const req = store.count();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB-based offline storage for POS operations.
 * Caches products locally and queues sales for sync when back online.
 */

const DB_NAME = 'ruinu-pos-offline';
const DB_VERSION = 1;

const STORES = {
  products: 'products',
  pendingSales: 'pending_sales',
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.products)) {
        db.createObjectStore(STORES.products, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.pendingSales)) {
        db.createObjectStore(STORES.pendingSales, { keyPath: 'offlineId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Products cache ──

export async function cacheProducts(products: any[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.products, 'readwrite');
  const store = tx.objectStore(STORES.products);
  // Clear old data then write fresh
  store.clear();
  for (const p of products) {
    store.put(p);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProducts(): Promise<any[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.products, 'readonly');
  const store = tx.objectStore(STORES.products);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
  paymentMethod: 'cash' | 'mpesa' | 'credit';
  soldOnBehalfOf?: string | null;
  soldOnBehalfName?: string | null;
  commissionAmount?: number;
  createdAt: string;
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

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/types/database';
import { cacheProducts, getCachedProducts, cacheCategories, getCachedCategories, addCachedProduct, queueOp } from '@/lib/offlineDb';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately for instant speed
      try {
        const [cachedP, cachedC] = await Promise.all([
          getCachedProducts(),
          getCachedCategories()
        ]);
        if (cachedP.length > 0) {
          setProducts(cachedP as Product[]);
          setLoading(false);
        }
        if (cachedC.length > 0) {
          setCategories(cachedC as Category[]);
        }
      } catch (err) {
        console.error('Initial cache load error:', err);
      }

      // 2. Fetch fresh data in background
      await Promise.all([fetchProducts(), fetchCategories()]);
    }

    init();

    // Set up realtime subscription
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [...prev, payload.new as Product]);
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Product) : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchProducts() {
    try {
      if (!navigator.onLine) {
        // Offline: load from cache directly
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          setProducts(cached as Product[]);
          setError('Working Offline');
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .order('name');

      if (error) throw error;
      setProducts(data as Product[]);
      cacheProducts(data).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch products, checking cache...', err);
      try {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          setProducts(cached as Product[]);
          setError(null);
          return;
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }

      if (!navigator.onLine) {
        setError('Working Offline');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data as Category[]);
      cacheCategories(data).catch(console.error);
    } catch (err) {
      console.error('Failed to fetch categories, checking cache...', err);
      try {
        const cached = await getCachedCategories();
        if (cached && cached.length > 0) {
          setCategories(cached as Category[]);
        }
      } catch (cacheErr) {
        console.error('Cache access failed:', cacheErr);
      }
    }
  }

  async function addProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
    if (!navigator.onLine) {
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();
      const localProduct = { ...product, id: tempId, created_at: now, updated_at: now } as Product;
      setProducts(prev => [...prev, localProduct]);
      addCachedProduct(localProduct).catch(console.error);
      await queueOp({ type: 'create_product', payload: product, createdAt: now, tempId });
      return localProduct;
    }
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
    if (!navigator.onLine) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
      await queueOp({ type: 'update_entity', payload: { table: 'products', id, updates }, createdAt: new Date().toISOString(), tempId: id });
      return { id, ...updates };
    }
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function addCategory(name: string) {
    if (!navigator.onLine) {
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();
      const localCat = { id: tempId, name, created_at: now } as Category;
      setCategories(prev => [...prev, localCat]);
      await queueOp({ type: 'create_category', payload: { name }, createdAt: now, tempId });
      return localCat;
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    setCategories((prev) => [...prev, data as Category]);
    return data;
  }

  async function decrementStock(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      await updateProduct(productId, { quantity: Math.max(0, product.quantity - quantity) });
    }
  }

  async function incrementStock(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      await updateProduct(productId, { quantity: product.quantity + quantity });
    }
  }

  const lowStockProducts = products.filter((p) => p.quantity <= p.low_stock_alert);

  function searchProducts(query: string): Product[] {
    if (!query.trim()) return products;
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery)
    );
  }

  // Locally decrement stock in memory (for offline sales)
  const localDecrementStock = useCallback((productId: string, quantity: number) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, quantity: Math.max(0, p.quantity - quantity) }
          : p
      )
    );
  }, []);

  return {
    products,
    categories,
    loading,
    error,
    lowStockProducts,
    addProduct,
    updateProduct,
    addCategory,
    decrementStock,
    incrementStock,
    searchProducts,
    localDecrementStock,
    refresh: fetchProducts,
  };
}

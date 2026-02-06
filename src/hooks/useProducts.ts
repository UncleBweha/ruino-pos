import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/types/database';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      await Promise.all([fetchProducts(), fetchCategories()]);
    }
    fetchAll();

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
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .order('name');

      if (error) throw error;
      setProducts(data as Product[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
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
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }

  async function addProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
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
    refresh: fetchProducts,
  };
}

import { useState, useCallback } from 'react';
import type { Product, CartItem } from '@/types/database';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [customerName, setCustomerName] = useState('');

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Check stock
        if (existing.quantity >= product.quantity) {
          return prev; // Don't add more than available
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * product.selling_price,
                profit: (item.quantity + 1) * (product.selling_price - product.buying_price),
              }
            : item
        );
      }
      // Check if product is in stock
      if (product.quantity <= 0) {
        return prev;
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          total: product.selling_price,
          profit: product.selling_price - product.buying_price,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        // Check stock
        const validQuantity = Math.min(quantity, item.product.quantity);
        return {
          ...item,
          quantity: validQuantity,
          total: validQuantity * item.product.selling_price,
          profit: validQuantity * (item.product.selling_price - item.product.buying_price),
        };
      })
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscount(0);
    setTaxRate(0);
    setCustomerName('');
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;
  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    discount,
    taxRate,
    customerName,
    subtotal,
    taxAmount,
    total,
    totalProfit,
    itemCount,
    addItem,
    removeItem,
    updateQuantity,
    setDiscount,
    setTaxRate,
    setCustomerName,
    clearCart,
  };
}

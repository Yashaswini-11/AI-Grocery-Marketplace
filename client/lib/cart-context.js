'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

const CartContext = createContext(null);
const EMPTY_CART = { items: [], itemCount: 0, total: 0 };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.id;

  // data = { owner: userId, cart } so a previous user's cart is never shown
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    apiFetch('/cart')
      .then((res) => {
        if (active) setData({ owner: userId, cart: res.cart });
      })
      .catch(() => {
        if (active) {
          setData({ owner: userId, cart: EMPTY_CART });
          showToast('Could not load your cart', 'error');
        }
      });

    return () => {
      active = false;
    };
  }, [userId, showToast]);

  const ready = Boolean(data && data.owner === userId);
  const cart = ready ? data.cart : EMPTY_CART;
  const cartLoading = Boolean(userId) && !ready;

  const run = useCallback(
    async (request, successMessage) => {
      try {
        const res = await request();
        setData({ owner: userId, cart: res.cart });
        if (successMessage) showToast(successMessage);
        return true;
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    },
    [userId, showToast]
  );

  const addItem = (productId, quantity = 1) =>
    run(
      () => apiFetch('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
      'Added to cart'
    );

  const updateItem = (productId, quantity) =>
    run(() =>
      apiFetch(`/cart/items/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
    );

  const removeItem = (productId) =>
    run(() => apiFetch(`/cart/items/${productId}`, { method: 'DELETE' }), 'Item removed');

  // Re-reads the cart from the server (used after a failed checkout)
  const refreshCart = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch('/cart');
      setData({ owner: userId, cart: res.cart });
    } catch {
      // keep the current cart
    }
  }, [userId]);

  // The server clears the cart when an order is placed; mirror that locally
  const resetCart = useCallback(() => {
    if (userId) setData({ owner: userId, cart: EMPTY_CART });
  }, [userId]);

  return (
    <CartContext.Provider
      value={{ cart, cartLoading, addItem, updateItem, removeItem, refreshCart, resetCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, cartLoading, updateItem, removeItem } = useCart();
  const [busyId, setBusyId] = useState(null);

  async function withBusy(productId, action) {
    setBusyId(productId);
    await action();
    setBusyId(null);
  }

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to view your cart.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (cartLoading) return <p className="text-gray-500">Loading your cart…</p>;

  if (cart.items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-gray-600">Your cart is empty.</p>
        <Link
          href="/"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Your cart</h1>

      <ul className="mt-4 flex flex-col gap-3">
        {cart.items.map((item) => {
          const busy = busyId === item.productId;
          const maxQty = Math.min(item.stock, 99);
          return (
            <li
              key={item.productId}
              className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-20 w-28 rounded object-cover"
              />

              <div className="flex-1">
                <Link href={`/products/${item.productId}`} className="font-medium hover:text-green-700">
                  {item.name}
                </Link>
                <p className="text-sm text-gray-500">
                  {formatPrice(item.unitPrice)} / {item.unit}
                </p>
                {!item.inStock && (
                  <p className="text-sm text-red-600">
                    Only {item.stock} {item.unit} available. Please reduce the quantity.
                  </p>
                )}
              </div>

              <div className="flex items-center rounded border">
                <button
                  onClick={() =>
                    withBusy(item.productId, () => updateItem(item.productId, item.quantity - 1))
                  }
                  disabled={busy || item.quantity <= 1}
                  className="px-3 py-1 disabled:text-gray-300"
                  aria-label={`Decrease ${item.name}`}
                >
                  −
                </button>
                <span className="w-10 text-center">{item.quantity}</span>
                <button
                  onClick={() =>
                    withBusy(item.productId, () => updateItem(item.productId, item.quantity + 1))
                  }
                  disabled={busy || item.quantity >= maxQty}
                  className="px-3 py-1 disabled:text-gray-300"
                  aria-label={`Increase ${item.name}`}
                >
                  +
                </button>
              </div>

              <div className="w-24 text-right font-medium">{formatPrice(item.lineTotal)}</div>

              <button
                onClick={() => withBusy(item.productId, () => removeItem(item.productId))}
                disabled={busy}
                className="text-sm text-red-600 hover:underline disabled:text-gray-300"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

            <div className="mt-6 flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-gray-600">
          {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
        </span>
        <span className="text-xl font-bold">Total: {formatPrice(cart.total)}</span>
        {cart.items.every((i) => i.inStock) ? (
          <Link
            href="/checkout"
            className="rounded bg-green-700 px-5 py-2 text-center text-white hover:bg-green-800"
          >
            Proceed to checkout
          </Link>
        ) : (
          <span className="text-sm text-red-600">Fix the stock issues above to continue</span>
        )}
      </div>
    </div>
  );
}
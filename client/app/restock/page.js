'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatDate, formatPrice } from '@/lib/format';

const STATUS = {
  overdue: { text: 'Likely running low', className: 'bg-red-100 text-red-700' },
  'due-soon': { text: 'Due soon', className: 'bg-amber-100 text-amber-800' },
  upcoming: { text: 'Coming up', className: 'bg-gray-100 text-gray-700' },
};

const CONFIDENCE = {
  high: 'Very regular pattern',
  medium: 'Fairly regular pattern',
  low: 'Irregular pattern',
};

function SuggestionCard({ item, onAdd, busy }) {
  const { product } = item;
  const qty = Math.max(1, Math.min(item.typicalQuantity, product.stock, 99));
  const badge = STATUS[item.status];

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl} alt={product.name} className="h-20 w-28 rounded object-cover" />

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/products/${product.id}`} className="font-medium hover:text-green-700">
            {product.name}
          </Link>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
          <span className="text-xs text-gray-500">{CONFIDENCE[item.confidence]}</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{item.explanation}</p>
        <p className="text-xs text-gray-500">
          Expected around {formatDate(item.nextExpectedAt)} · {formatPrice(product.price)} / {product.unit}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onAdd(product, qty)}
        disabled={busy || product.stock === 0}
        className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {product.stock === 0 ? 'Out of stock' : busy ? 'Adding…' : `Add ${qty} to cart`}
      </button>
    </li>
  );
}

export default function RestockPage() {
  const { user, loading: authLoading } = useAuth();
  const { addItem } = useCart();
  const userId = user?.id;

  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [result, setResult] = useState(null); // { key, data, error }

  const requestKey = `${userId}|${reloadKey}`;
  const loading = Boolean(userId) && result?.key !== requestKey;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    apiFetch('/reorder/suggestions')
      .then((res) => {
        if (active) setResult({ key: requestKey, data: res, error: null });
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, data: null, error: err.message });
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey, requestKey]);


  async function handleAdd(product, quantity) {
    setBusyId(product.id);
    await addItem(product.id, Math.max(1, Math.min(quantity, product.stock, 99)));
    setBusyId(null);
  }

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to see your restock suggestions.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Time to restock</h1>
      <p className="mt-1 text-gray-600">
        Suggestions based on how often you&apos;ve bought items before. They&apos;re estimates, not
        guarantees.
      </p>

      <div className="mt-4">
        {loading && <p className="text-gray-500">Looking at your order history…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-2 rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && data.orderCount === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="text-gray-600">{data.message}</p>
            <Link
              href="/"
              className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
            >
              Start shopping
            </Link>
          </div>
        )}

        {!loading && !error && data && data.orderCount > 0 && (
          <>
            {data.message && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {data.message}
              </p>
            )}

            {data.restock.length > 0 && (
              <section className="mt-2">
                <h2 className="text-lg font-semibold">Restock now</h2>
                <ul className="mt-2 flex flex-col gap-3">
                  {data.restock.map((item) => (
                    <SuggestionCard
                      key={item.product.id}
                      item={item}
                      onAdd={handleAdd}
                      busy={busyId === item.product.id}
                    />
                  ))}
                </ul>
              </section>
            )}

            {data.upcoming.length > 0 && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold">Coming up</h2>
                <ul className="mt-2 flex flex-col gap-3">
                  {data.upcoming.map((item) => (
                    <SuggestionCard
                      key={item.product.id}
                      item={item}
                      onAdd={handleAdd}
                      busy={busyId === item.product.id}
                    />
                  ))}
                </ul>
              </section>
            )}

            {data.recent.length > 0 && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold">Buy again</h2>
                <p className="text-sm text-gray-500">Items you bought recently.</p>
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {data.recent.map((r) => (
                    <li
                      key={r.product.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-white p-3"
                    >
                      <div>
                        <p className="font-medium">{r.product.name}</p>
                        <p className="text-xs text-gray-500">
                          Last bought {formatDate(r.lastPurchasedAt)} · {r.timesPurchased}×
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(r.product, r.lastQuantity)}
                        disabled={busyId === r.product.id || r.product.stock === 0}
                        className="rounded border px-3 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        {r.product.stock === 0 ? 'Out of stock' : busyId === r.product.id ? 'Adding…' : 'Add to cart'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
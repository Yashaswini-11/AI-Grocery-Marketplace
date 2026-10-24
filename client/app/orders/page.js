'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, formatPrice, shortOrderId } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState(null); // { key, orders, error }

  const requestKey = `${userId}|${reloadKey}`;
  const loading = Boolean(userId) && result?.key !== requestKey;
  const orders = result?.orders ?? [];
  const error = result?.error ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    apiFetch('/orders')
      .then((data) => {
        if (active) setResult({ key: requestKey, orders: data.orders, error: null });
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, orders: [], error: err.message });
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey, requestKey]);

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to see your orders.</p>
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
      <h1 className="text-2xl font-bold">Your orders</h1>

      <div className="mt-4">
        {loading && <p className="text-gray-500">Loading orders…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-2 rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="text-gray-600">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/"
              className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
            >
              Start shopping
            </Link>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-lg border bg-white p-4 hover:border-green-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">Order #{shortOrderId(order.id)}</p>
                    <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                    <p className="text-sm text-gray-600">
                      {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={order.status} />
                    <span className="font-bold">{formatPrice(order.totalAmount)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
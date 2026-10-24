'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ORDER_STATUSES,
  formatDateTime,
  formatPrice,
  shortOrderId,
} from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

function OrderDetail() {
  const { id } = useParams();
  const justPlaced = useSearchParams().get('placed') === '1';
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    apiFetch(`/orders/${id}`)
      .then((data) => {
        if (active) setOrder(data.order);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, userId]);

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to view this order.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (loading) return <p className="text-gray-500">Loading order…</p>;

  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <Link href="/orders" className="mt-2 inline-block text-green-700 underline">
          Back to your orders
        </Link>
      </div>
    );
  }

  const currentStep = ORDER_STATUSES.indexOf(order.status);

  return (
    <div>
      {justPlaced && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <p className="font-semibold">Order placed successfully 🎉</p>
          <p className="text-sm">
            Order #{shortOrderId(order.id)} is confirmed. Pay{' '}
            {formatPrice(order.totalAmount)} in cash on delivery.
          </p>
        </div>
      )}

      <Link href="/orders" className="text-sm text-green-700 hover:underline">
        ← All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Order #{shortOrderId(order.id)}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-sm text-gray-500">Placed on {formatDateTime(order.createdAt)}</p>

      <ol className="mt-5 grid grid-cols-5 gap-1 text-center text-xs">
        {ORDER_STATUSES.map((step, i) => (
          <li key={step}>
            <div className={`h-1.5 rounded ${i <= currentStep ? 'bg-green-700' : 'bg-gray-200'}`} />
            <span className={`mt-1 inline-block ${i <= currentStep ? 'text-green-800' : 'text-gray-400'}`}>
              {step}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <section className="rounded-lg border bg-white p-4 md:col-span-3">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 flex flex-col divide-y">
            {order.items.map((item) => (
              <li key={`${item.product}`} className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-gray-500">
                    {item.quantity} × {formatPrice(item.price)} / {item.unit}
                  </p>
                </div>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </section>

        <aside className="flex flex-col gap-4 md:col-span-2">
          <section className="rounded-lg border bg-white p-4 text-sm">
            <h2 className="font-semibold">Delivery address</h2>
            <p className="mt-2">{order.delivery.fullName}</p>
            <p>{order.delivery.line1}</p>
            {order.delivery.line2 && <p>{order.delivery.line2}</p>}
            <p>
              {order.delivery.city}, {order.delivery.state} {order.delivery.pincode}
            </p>
            <p className="mt-1 text-gray-600">Phone: {order.delivery.phone}</p>
          </section>

          <section className="rounded-lg border bg-white p-4 text-sm">
            <h2 className="font-semibold">Payment</h2>
            <p className="mt-2">
              {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
            </p>
            <p className="text-gray-600">Status: {order.paymentStatus}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading order…</p>}>
      <OrderDetail />
    </Suspense>
  );
}
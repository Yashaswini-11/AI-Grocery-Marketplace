'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';

const INITIAL = { fullName: null, phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { cart, cartLoading, refreshCart, resetCart } = useCart();

  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const idempotencyKey = useRef(null);

  const fullName = form.fullName ?? user?.name ?? '';
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const phone = form.phone.replace(/[\s-]/g, '');
    if (!/^(\+?91)?[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) {
      setError('Enter a valid 6-digit pincode');
      return;
    }

    // One key per checkout visit: a double-click or retry can never create two orders
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    setSubmitting(true);
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          delivery: { ...form, fullName },
          paymentMethod: 'COD',
        }),
      });
      setDone(true);
      resetCart();
      router.push(`/orders/${data.order.id}?placed=1`);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) refreshCart(); // stock changed: show the latest cart
      setSubmitting(false);
    }
  }

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to check out.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (done) return <p className="text-gray-600">Order placed. Redirecting…</p>;
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

  const stockProblem = cart.items.some((i) => !i.inStock);
  const inputClass = 'mt-1 w-full rounded border px-3 py-2 outline-none focus:border-green-700';

  return (
    <div>
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="mt-4 grid gap-6 md:grid-cols-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:col-span-3">
          <h2 className="font-semibold">Delivery details</h2>

          <label className="text-sm">
            Full name
            <input
              required
              value={fullName}
              onChange={set('fullName')}
              autoComplete="name"
              className={inputClass}
            />
          </label>

          <label className="text-sm">
            Mobile number
            <input
              required
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="10-digit number"
              className={inputClass}
            />
          </label>

          <label className="text-sm">
            Address line 1
            <input
              required
              value={form.line1}
              onChange={set('line1')}
              autoComplete="address-line1"
              placeholder="House / flat, street"
              className={inputClass}
            />
          </label>

          <label className="text-sm">
            Address line 2 (optional)
            <input
              value={form.line2}
              onChange={set('line2')}
              autoComplete="address-line2"
              placeholder="Landmark, area"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              City
              <input
                required
                value={form.city}
                onChange={set('city')}
                autoComplete="address-level2"
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              State
              <input
                required
                value={form.state}
                onChange={set('state')}
                autoComplete="address-level1"
                className={inputClass}
              />
            </label>
          </div>

          <label className="text-sm sm:w-1/2">
            Pincode
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={set('pincode')}
              autoComplete="postal-code"
              className={inputClass}
            />
          </label>

          <div className="rounded border bg-white p-3 text-sm">
            <span className="font-medium">Payment:</span> Cash on Delivery. Pay when your order
            arrives.
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}{' '}
              {error.toLowerCase().includes('stock') || error.toLowerCase().includes('available') ? (
                <Link href="/cart" className="underline">
                  Review cart
                </Link>
              ) : null}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || stockProblem}
            className="rounded bg-green-700 px-4 py-3 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Placing order…' : `Place order · ${formatPrice(cart.total)}`}
          </button>

          {stockProblem && (
            <p className="text-sm text-red-600">
              Some items exceed available stock.{' '}
              <Link href="/cart" className="underline">
                Fix in cart
              </Link>
            </p>
          )}
        </form>

        <aside className="h-fit rounded-lg border bg-white p-4 md:col-span-2">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-2">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t pt-3 font-bold">
            <span>Total</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Final prices are confirmed by the server when you place the order.
          </p>
        </aside>
      </div>
    </div>
  );
}
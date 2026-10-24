'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice, stockLabel } from '@/lib/format';

function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/products/${id}`)
      .then((data) => {
        if (active) setProduct(data.product);
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
  }, [id]);

  async function handleAdd() {
    if (!user) {
      router.push('/login');
      return;
    }
    setAdding(true);
    await addItem(product.id, qty);
    setAdding(false);
  }

  if (loading) return <p className="text-gray-500">Loading product…</p>;
  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-2 inline-block text-green-700 underline">
          Back to products
        </Link>
      </div>
    );
  }

  const stock = stockLabel(product.stock);
  const maxQty = Math.min(product.stock, 99);

  return (
    <div>
      <Link href="/" className="text-sm text-green-700 hover:underline">
        ← Back to products
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full rounded-lg border bg-white object-cover"
        />

        <div>
          <span className="text-sm text-gray-500">{product.category}</span>
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
          <p className="mt-2 text-xl">
            {formatPrice(product.price)} <span className="text-base text-gray-500">/ {product.unit}</span>
          </p>
          <p className={`mt-1 text-sm ${stock.className}`}>{stock.text}</p>
          {product.description && <p className="mt-4 text-gray-700">{product.description}</p>}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded border bg-white">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="px-3 py-2 disabled:text-gray-300"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-10 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
                className="px-3 py-2 disabled:text-gray-300"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={product.stock === 0 || adding}
              className="rounded bg-green-700 px-5 py-2 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {adding ? 'Adding…' : product.stock === 0 ? 'Out of stock' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function ProductDetailPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading product…</p>}>
      <ProductDetail />
    </Suspense>
  );
}
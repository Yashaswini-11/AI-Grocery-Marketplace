'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice, stockLabel } from '@/lib/format';

export default function ProductCard({ product }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const stock = stockLabel(product.stock);

  async function handleAdd() {
    if (!user) {
      router.push('/login');
      return;
    }
    setAdding(true);
    await addItem(product.id, 1);
    setAdding(false);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
      <Link href={`/products/${product.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-xs text-gray-500">{product.category}</span>
        <Link href={`/products/${product.id}`} className="font-medium hover:text-green-700">
          {product.name}
        </Link>
        <span className="text-sm">
          {formatPrice(product.price)} <span className="text-gray-500">/ {product.unit}</span>
        </span>
        <span className={`text-xs ${stock.className}`}>{stock.text}</span>

        <button
          onClick={handleAdd}
          disabled={product.stock === 0 || adding || loading}
          className="mt-auto rounded bg-green-700 px-3 py-2 text-sm text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {adding ? 'Adding…' : product.stock === 0 ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}
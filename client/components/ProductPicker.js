'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatPrice, stockLabel } from '@/lib/format';

export default function ProductPicker({
  onPick,
  actionLabel = 'Select',
  placeholder = 'Search products (e.g. milk, rice)',
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [result, setResult] = useState(null); // { query, products, error }

  const searching = query.length >= 2;
  const current = searching && result?.query === query ? result : null;
  const loading = searching && !current;
  const results = current?.products ?? [];
  const error = current?.error ?? null;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (query.length < 2) return;
    let active = true;

    apiFetch(`/products/search?q=${encodeURIComponent(query)}&limit=6`)
      .then((data) => {
        if (active) setResult({ query, products: data.products, error: null });
      })
      .catch((err) => {
        if (active) setResult({ query, products: [], error: err.message });
      });

    return () => {
      active = false;
    };
  }, [query]);

  async function handlePick(product) {
    setBusyId(product.id);
    await onPick(product);
    setBusyId(null);
  }

  return (
    <div>
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-green-700"
      />

      <div className="mt-2">
        {loading && <p className="text-sm text-gray-500">Searching…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && searching && results.length === 0 && (
          <p className="text-sm text-gray-500">No products found for &ldquo;{query}&rdquo;.</p>
        )}

        {searching && results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((p) => {
              const stock = stockLabel(p.stock);
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-gray-500">
                      {formatPrice(p.price)} / {p.unit} ·{' '}
                      <span className={stock.className}>{stock.text}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePick(p)}
                    disabled={p.stock === 0 || busyId === p.id}
                    className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {busyId === p.id ? '…' : actionLabel}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
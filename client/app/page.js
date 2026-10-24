'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CATEGORIES } from '@/lib/format';
import ProductCard from '@/components/ProductCard';

export default function HomePage() {
    const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState(null); // { key, products, error }

  const requestKey = `${category}|${query}|${reloadKey}`;
  const loading = result?.key !== requestKey;
  const products = result?.products ?? [];
  const error = result?.error ?? null;

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: '100' });
    if (category) params.set('category', category);
    if (query) params.set('q', query);

    apiFetch(`/products?${params}`)
      .then((data) => {
        if (active) setResult({ key: requestKey, products: data.products, error: null });
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, products: [], error: err.message });
      });

    return () => {
      active = false;
    };
  }, [category, query, reloadKey, requestKey]);
  
   const chip = (label, value) => (
    <button
      key={label}
      onClick={() => setCategory(value)}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
        category === value ? 'border-green-700 bg-green-700 text-white' : 'bg-white hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Fresh groceries, delivered</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products (e.g. milk, rice, kela)"
        className="mt-4 w-full rounded-lg border bg-white px-4 py-2 outline-none focus:border-green-700"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {chip('All', '')}
        {CATEGORIES.map((c) => chip(c, c))}
      </div>

      <div className="mt-6">
        {loading && <p className="text-gray-500">Loading products…</p>}

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

        {!loading && !error && products.length === 0 && (
          <p className="text-gray-500">No products found. Try a different search or category.</p>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
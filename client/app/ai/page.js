'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { rowsFromItems } from '@/lib/aiSelection';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { parseListLocally } from '@/lib/localParse';
import { useToast } from '@/lib/toast-context';
import AiReviewRow from '@/components/AiReviewRow';
import ProductPicker from '@/components/ProductPicker';

const MAX_CHARS = 1000;

export default function AiListPage() {
  const { user, loading: authLoading } = useAuth();
  const { addItem, refreshCart } = useCart();
  const { showToast } = useToast();

  const [aiAvailable, setAiAvailable] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null); // 'ai' | 'basic' | null
  const [error, setError] = useState(null); // { message, canFallback }
  const [rows, setRows] = useState([]);
  const [notices, setNotices] = useState([]);
  const [source, setSource] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    apiFetch('/ai/status')
      .then((data) => setAiAvailable(Boolean(data.available)))
      .catch(() => {});
  }, []);

  async function convert(kind) {
    const trimmed = text.trim();
    if (!trimmed) {
      setError({ message: 'Enter your grocery list first.', canFallback: false });
      return;
    }

    setBusy(kind);
    setError(null);

    try {
      let data;
      if (kind === 'ai') {
        data = await apiFetch('/ai/parse-list', {
          method: 'POST',
          body: JSON.stringify({ text: trimmed }),
        });
      } else {
        const items = parseListLocally(trimmed);
        if (items.length === 0) {
          setError({
            message: 'We could not find any items in that text. Try separating items with commas.',
            canFallback: false,
          });
          return;
        }
        data = await apiFetch('/ai/match-items', {
          method: 'POST',
          body: JSON.stringify({ items }),
        });
      }

      const newRows = rowsFromItems(data.items);
      const newNotices = [];
      if (data.skipped > 0) {
        newNotices.push(`${data.skipped} part(s) of the list could not be read and were skipped.`);
      }
      if (data.truncated) {
        newNotices.push('Only the first 40 items were processed. Split a long list into two.');
      }

      setRows(newRows);
      setNotices(newNotices);
      setSource(kind);

      if (newRows.length === 0) {
        setError({
          message: data.message || 'We could not find any grocery items in that text.',
          canFallback: false,
        });
      }
    } catch (err) {
      setError({
        message: err.message,
        canFallback: kind === 'ai' && ![400, 401].includes(err.status),
      });
    } finally {
      setBusy(null);
    }
  }

  function updateRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: null } : r)));
  }

  function skipRow(key) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  async function addSelected() {
    const targets = rows.filter((r) => r.include && r.selection && !r.added);
    if (targets.length === 0) return;

    setAdding(true);
    let ok = 0;
    let failed = 0;

    // One at a time: the cart is updated read-modify-write on the server
    for (const row of targets) {
      try {
        await apiFetch('/cart/items', {
          method: 'POST',
          body: JSON.stringify({
            productId: row.selection.product.id,
            quantity: row.selection.quantity,
          }),
        });
        ok += 1;
        setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, added: true, error: null } : r)));
      } catch (err) {
        failed += 1;
        setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, error: err.message } : r)));
      }
    }

    await refreshCart();
    setAdding(false);

    if (ok > 0) showToast(`${ok} item${ok === 1 ? '' : 's'} added to cart`);
    if (failed > 0) showToast(`${failed} item${failed === 1 ? '' : 's'} could not be added`, 'error');
  }

  function startOver() {
    setRows([]);
    setNotices([]);
    setSource(null);
    setError(null);
    setText('');
  }

  if (authLoading) return <p className="text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p>Please log in to use the AI grocery list.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  const included = rows.filter((r) => r.include && r.selection && !r.added);
  const total =
    Math.round(included.reduce((sum, r) => sum + r.selection.product.price * r.selection.quantity, 0) * 100) / 100;
  const unresolved = rows.filter((r) => !r.selection && !r.added).length;
  const allDone = rows.length > 0 && rows.every((r) => r.added);

  return (
    <div>
      <h1 className="text-2xl font-bold">AI grocery list</h1>
      <p className="mt-1 text-gray-600">
        Type your list the way you&apos;d say it. We&apos;ll match it to real products so you can review
        it before anything goes into your cart.
      </p>

      {!aiAvailable && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          AI reading is not available right now. You can still use basic matching below, or search
          products manually.
        </div>
      )}

      <div className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHARS}
          rows={4}
          placeholder="e.g. 2 litres of milk, 1 kg of rice, 6 eggs, bananas and bread"
          className="w-full rounded-lg border bg-white p-3 outline-none focus:border-green-700"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {text.length}/{MAX_CHARS}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => convert('ai')}
            disabled={busy !== null || !aiAvailable}
            className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy === 'ai' ? 'Reading your list…' : 'Convert with AI'}
          </button>
          <button
            type="button"
            onClick={() => convert('basic')}
            disabled={busy !== null}
            className="rounded border px-4 py-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            {busy === 'basic' ? 'Matching…' : 'Match without AI'}
          </button>
        </div>
        {busy === 'ai' && (
          <p className="mt-2 text-sm text-gray-500">This can take a few seconds…</p>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error.message}</p>
          {error.canFallback && (
            <>
              <p className="mt-1 text-sm">
                Your list is still here. You can try again, or use basic matching, which doesn&apos;t
                need the AI service.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => convert('ai')}
                  disabled={busy !== null}
                  className="rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => convert('basic')}
                  disabled={busy !== null}
                  className="rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
                >
                  Match without AI
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Review your items</h2>
          {source === 'basic' && (
            <p className="text-sm text-amber-700">
              Matched without AI (basic matching). Please double-check the quantities.
            </p>
          )}
          {notices.map((n) => (
            <p key={n} className="text-sm text-amber-700">
              {n}
            </p>
          ))}
          <p className="text-sm text-gray-500">
            Items are added on top of what&apos;s already in your cart. Prices and stock come from our
            catalog.
          </p>

          {allDone && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              <p className="font-semibold">All done. Your items are in the cart.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/cart" className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800">
                  View cart
                </Link>
                <Link href="/checkout" className="rounded border border-green-700 px-3 py-1 hover:bg-green-100">
                  Checkout
                </Link>
                <button type="button" onClick={startOver} className="px-3 py-1 underline">
                  Start a new list
                </button>
              </div>
            </div>
          )}

          <ul className="mt-3 flex flex-col gap-3">
            {rows.map((row) => (
              <AiReviewRow
                key={row.key}
                row={row}
                disabled={adding}
                onChange={(patch) => updateRow(row.key, patch)}
                onSkip={() => skipRow(row.key)}
              />
            ))}
          </ul>

          {!allDone && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                {included.length} item{included.length === 1 ? '' : 's'} selected
                {unresolved > 0 && (
                  <span className="block text-amber-700">
                    {unresolved} item{unresolved === 1 ? ' still needs' : 's still need'} a choice (or skip
                    {unresolved === 1 ? ' it' : ' them'}).
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={addSelected}
                disabled={adding || included.length === 0}
                className="rounded bg-green-700 px-5 py-2 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {adding ? 'Adding…' : `Add to cart · ${formatPrice(total)}`}
              </button>
            </div>
          )}
        </section>
      )}

      <details className="mt-8 rounded-lg border bg-white p-4" open={!aiAvailable || Boolean(error)}>
        <summary className="cursor-pointer font-medium">Prefer to search yourself? Add items manually</summary>
        <div className="mt-3">
          <ProductPicker actionLabel="Add to cart" onPick={(p) => addItem(p.id, 1)} />
        </div>
      </details>
    </div>
  );
}
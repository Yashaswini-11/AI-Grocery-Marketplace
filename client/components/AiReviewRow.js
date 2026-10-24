'use client';

import { useState } from 'react';
import { describeRequest, toSelection } from '@/lib/aiSelection';
import { formatPrice, stockLabel } from '@/lib/format';
import ProductPicker from '@/components/ProductPicker';

const BADGES = {
  matched: { text: 'Matched', className: 'bg-green-100 text-green-800' },
  selected: { text: 'Selected', className: 'bg-blue-100 text-blue-800' },
  ambiguous: { text: 'Choose one', className: 'bg-amber-100 text-amber-800' },
  unmatched: { text: 'Not found', className: 'bg-red-100 text-red-700' },
  added: { text: 'Added ✓', className: 'bg-green-100 text-green-800' },
};

export default function AiReviewRow({ row, onChange, onSkip, disabled }) {
  const [changing, setChanging] = useState(false);
  const { selection } = row;

  const badgeKey = row.added
    ? 'added'
    : selection
      ? row.status === 'matched'
        ? 'matched'
        : 'selected'
      : row.status;
  const badge = BADGES[badgeKey];

  const chooserOpen = !row.added && (!selection || changing);
  const understood = describeRequest(row.requested);

  function choose(source) {
    const next = toSelection(source);
    onChange({ selection: next, include: next.product.stock > 0 });
    setChanging(false);
  }

  function setQty(quantity) {
    onChange({ selection: { ...selection, quantity } });
  }

  const product = selection?.product;
  const maxQty = product ? Math.max(1, Math.min(product.stock, 99)) : 1;
  const stock = product ? stockLabel(product.stock) : null;
  const notes = [...(selection?.notes || [])];
  if (selection?.matchType === 'fuzzy') {
    notes.push('Matched despite a spelling difference. Please check this is right.');
  }

  return (
    <li className={`rounded-lg border p-3 ${row.added ? 'border-green-200 bg-green-50' : 'bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">You wrote</p>
          <p className="font-medium">&ldquo;{row.originalText}&rdquo;</p>
          {understood && <p className="text-xs text-gray-500">Understood as: {understood}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      {row.added && product && (
        <p className="mt-2 text-sm text-green-800">
          {product.name} × {selection.quantity} was added to your cart.
        </p>
      )}

      {selection && !row.added && !changing && (
        <>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt={product.name} className="h-16 w-24 rounded object-cover" />

            <div className="flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-gray-500">
                {formatPrice(product.price)} / {product.unit} ·{' '}
                <span className={stock.className}>{stock.text}</span>
              </p>
            </div>

            <div className="flex items-center rounded border">
              <button
                type="button"
                onClick={() => setQty(selection.quantity - 1)}
                disabled={disabled || selection.quantity <= 1}
                className="px-3 py-1 disabled:text-gray-300"
                aria-label={`Decrease ${product.name}`}
              >
                −
              </button>
              <span className="w-10 text-center">{selection.quantity}</span>
              <button
                type="button"
                onClick={() => setQty(selection.quantity + 1)}
                disabled={disabled || selection.quantity >= maxQty}
                className="px-3 py-1 disabled:text-gray-300"
                aria-label={`Increase ${product.name}`}
              >
                +
              </button>
            </div>

            <div className="w-24 text-right font-medium">
              {formatPrice(product.price * selection.quantity)}
            </div>
          </div>

          {notes.map((note) => (
            <p key={note} className="mt-1 text-xs text-amber-700">
              {note}
            </p>
          ))}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.include}
                disabled={disabled || product.stock === 0}
                onChange={(e) => onChange({ include: e.target.checked })}
              />
              Add to cart
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChanging(true)}
                disabled={disabled}
                className="text-green-700 underline disabled:text-gray-300"
              >
                Change product
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={disabled}
                className="text-red-600 underline disabled:text-gray-300"
              >
                Skip
              </button>
            </div>
          </div>
        </>
      )}

      {chooserOpen && (
        <div className="mt-3 rounded border border-dashed p-3">
          {!selection && row.status === 'unmatched' && (
            <p className="mb-2 text-sm text-red-700">
              We couldn&apos;t find this in our catalog. Search for something similar, or skip it.
            </p>
          )}
          {!selection && row.status === 'ambiguous' && (
            <p className="mb-2 text-sm text-amber-700">
              This could be more than one product. Pick the right one below.
            </p>
          )}

          {row.candidates.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-sm font-medium">Suggestions</p>
              <ul className="flex flex-col gap-2">
                {row.candidates.map((c) => (
                  <li
                    key={c.product.id}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <span>
                      {c.product.name} · {formatPrice(c.product.price)} / {c.product.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => choose(c)}
                      disabled={disabled}
                      className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800 disabled:bg-gray-300"
                    >
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mb-1 text-sm font-medium">Search the catalog</p>
          <ProductPicker actionLabel="Use this" onPick={choose} />

          <div className="mt-3 flex gap-4 text-sm">
            {selection && (
              <button type="button" onClick={() => setChanging(false)} className="underline">
                Cancel
              </button>
            )}
            <button type="button" onClick={onSkip} disabled={disabled} className="text-red-600 underline">
              Skip this item
            </button>
          </div>
        </div>
      )}

      {row.error && <p className="mt-2 text-sm text-red-600">{row.error}</p>}
    </li>
  );
}
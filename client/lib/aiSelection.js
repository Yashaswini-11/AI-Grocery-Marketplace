// Turns a server match/candidate, or a bare product from catalog search, into a cart selection.
export function toSelection(source) {
  const fromServer = Boolean(source.product);
  const product = fromServer ? source.product : source;
  const wanted = fromServer ? source.quantity : 1;
  const maxQty = Math.max(1, Math.min(product.stock, 99));

  return {
    product,
    quantity: Math.min(wanted, maxQty),
    notes: fromServer ? source.notes || [] : [],
    matchType: source.matchType || 'manual',
  };
}

export function rowsFromItems(items) {
  return items.map((item) => {
    const selection = item.status === 'matched' ? toSelection(item.match) : null;
    return {
      key: item.index,
      originalText: item.originalText,
      name: item.name,
      requested: item.requested,
      status: item.status,
      candidates: item.candidates || [],
      selection,
      include: Boolean(selection && selection.product.stock > 0),
      added: false,
      error: null,
    };
  });
}

export function describeRequest(requested) {
  if (!requested || requested.quantity == null) return '';
  return `${requested.quantity}${requested.unit ? ` ${requested.unit}` : ''}`;
}
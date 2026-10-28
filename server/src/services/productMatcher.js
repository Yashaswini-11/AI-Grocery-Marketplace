const { prisma } = require('../config/db');
const { productSummary } = require('../utils/serializers');

const MATCH_MIN = 0.8; // score needed to auto-match
const MARGIN = 0.1; // lead needed over the runner-up product
const AMBIGUOUS_MIN = 0.5; // below this, nothing is close enough

const STOP_WORDS = new Set([
  'fresh', 'organic', 'pack', 'packet', 'packets', 'pkt', 'pkts', 'of', 'the', 'a', 'an', 'and',
  'some', 'good', 'quality', 'large', 'small', 'medium', 'big', 'loaf', 'loaves', 'bottle',
  'bottles', 'bunch', 'bunches', 'roll', 'rolls', 'kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams',
  'litre', 'litres', 'liter', 'liters', 'l', 'ltr', 'ml', 'pc', 'pcs', 'piece', 'pieces', 'dozen',
]);

const FACTORS = {
  kg: ['mass', 1],
  g: ['mass', 0.001],
  litre: ['volume', 1],
  ml: ['volume', 0.001],
  piece: ['count', 1],
  dozen: ['count', 12],
};

const round2 = (n) => Math.round(n * 100) / 100;

function singular(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?\s*(?:kgs?|gms?|g|ml|ltr|l|litres?|liters?|pcs?)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t))
    .filter((t) => !STOP_WORDS.has(t))
    .map(singular);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function tokenSimilarity(a, b) {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 4) return 0; // short words must match exactly
  const sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return sim >= 0.75 ? sim : 0;
}

function scoreTokens(query, term) {
  if (!query.length || !term.length) return { score: 0, type: 'none' };

  if (query.join(' ') === term.join(' ')) return { score: 1, type: 'exact' };

  const termSet = new Set(term);
  const querySet = new Set(query);

  // every query word appears in the product term ("milk" in "full cream milk")
  if (query.every((t) => termSet.has(t))) {
    return { score: 0.7 + 0.2 * (query.length / term.length), type: 'partial' };
  }
  // the product term is only a part of the query ("tomato sauce" contains "tomato"): weak
  if (term.every((t) => querySet.has(t))) {
    return { score: 0.55 + 0.2 * (term.length / query.length), type: 'partial' };
  }

  // typo tolerance
  let total = 0;
  for (const q of query) {
    let best = 0;
    for (const t of term) best = Math.max(best, tokenSimilarity(q, t));
    total += best;
  }
  const coverage = total / query.length;
  if (coverage < 0.7) return { score: 0, type: 'none' };
  const sizeFactor = Math.sqrt(Math.min(query.length, term.length) / Math.max(query.length, term.length));
  return { score: 0.95 * coverage * sizeFactor, type: 'fuzzy' };
}

async function loadCatalog() {
  const products = await prisma.product.findMany();
  return products.map((row) => ({
    // price is a Decimal in the database; the matcher works with plain numbers
    product: { ...row, price: Number(row.price) },
    terms: [
      tokenize(String(row.name).replace(/\([^)]*\)/g, ' ')),
      ...(row.aliases || []).map(tokenize),
    ].filter((t) => t.length > 0),
  }));
}

function rank(name, catalog) {
  const query = tokenize(name);
  if (query.length === 0) return [];

  const results = [];
  for (const entry of catalog) {
    let best = { score: 0, type: 'none' };
    for (const term of entry.terms) {
      const s = scoreTokens(query, term);
      if (s.score > best.score) best = s;
    }
    if (best.score > 0) results.push({ product: entry.product, score: best.score, type: best.type });
  }
  return results.sort(
    (a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name)
  );
}

const fmt = (n) => String(round2(n));

// Converts what the user asked for into whole units of the product (the cart takes whole numbers 1-99).
function planQuantity(requested, product) {
  const notes = [];
  let needsReview = false;
  let qty;

  const { quantity: amount, unit } = requested;
  const target = FACTORS[product.unit];

  if (amount == null) {
    qty = 1;
    notes.push(`No quantity given, so we started with 1 ${product.unit}.`);
  } else if (!unit) {
    qty = Math.ceil(amount - 1e-9);
    if (Math.abs(amount - qty) > 1e-9) {
      notes.push(`Quantities are whole numbers, so ${fmt(amount)} was rounded up to ${qty}.`);
    }
  } else {
    const from = FACTORS[unit];
    if (from && target && from[0] === target[0]) {
      const needed = (amount * from[1]) / target[1];
      qty = Math.ceil(needed - 1e-9);
      if (Math.abs(needed - qty) > 1e-9) {
        notes.push(
          `You asked for ${fmt(amount)} ${unit}. This is sold in whole ${product.unit}, so we rounded up to ${qty} ${product.unit}.`
        );
      }
    } else {
      qty = 1;
      needsReview = true;
      notes.push(
        `You asked for ${fmt(amount)} ${unit}, but this is sold per ${product.unit}. We started with 1 ${product.unit}. Please check.`
      );
    }
  }

  if (qty < 1) qty = 1;
  if (qty > 99) {
    qty = 99;
    needsReview = true;
    notes.push('The maximum is 99 per item, so the quantity was reduced to 99.');
  }

  if (product.stock <= 0) {
    needsReview = true;
    notes.push('This item is currently out of stock.');
  } else if (qty > product.stock) {
    needsReview = true;
    notes.push(`Only ${product.stock} ${product.unit} in stock.`);
  }

  return { qty, notes, needsReview };
}

function buildSelection(product, requested) {
  const plan = planQuantity(requested, product);
  return {
    product: productSummary(product), // price and stock always come from the database
    quantity: plan.qty,
    lineTotal: round2(product.price * plan.qty),
    notes: plan.notes,
    needsReview: plan.needsReview,
  };
}

// items: [{ name, quantity, unit, originalText }]  ->  one result per item, never dropped
async function matchItems(items) {
  const catalog = await loadCatalog();

  return items.map((item, index) => {
    const requested = { quantity: item.quantity ?? null, unit: item.unit ?? null };
    const base = { index, originalText: item.originalText || item.name, name: item.name, requested };

    const ranked = rank(item.name, catalog);
    const [best, second] = ranked;

    if (!best || best.score < AMBIGUOUS_MIN) {
      return { ...base, status: 'unmatched', match: null, candidates: [] };
    }

    if (best.score >= MATCH_MIN && (!second || best.score - second.score >= MARGIN)) {
      const selection = buildSelection(best.product, requested);
      return {
        ...base,
        status: 'matched',
        match: {
          ...selection,
          needsReview: selection.needsReview || best.type === 'fuzzy',
          matchType: best.type,
          score: round2(best.score),
        },
        candidates: [],
      };
    }

    const candidates = ranked
      .filter((r) => r.score >= AMBIGUOUS_MIN)
      .slice(0, 4)
      .map((r) => ({
        ...buildSelection(r.product, requested),
        matchType: r.type,
        score: round2(r.score),
      }));

    return { ...base, status: 'ambiguous', match: null, candidates };
  });
}

module.exports = { matchItems, tokenize };
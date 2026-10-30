const { prisma } = require('../config/db');
const { productSummary } = require('../utils/serializers');

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PURCHASES = 3; // distinct purchases needed before we estimate anything
const SAME_TRIP_DAYS = 1; // purchases closer than this count as one shopping trip
const DUE_SOON_DAYS = 3;
const LAPSED_FACTOR = 3; // not bought for 3x the usual gap => no longer a regular buy
const RECENT_LIMIT = 8;

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mean = (nums) => nums.reduce((a, b) => a + b, 0) / nums.length;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function daysText(n) {
  const d = Math.max(1, Math.round(n));
  return `${d} day${d === 1 ? '' : 's'}`;
}

// productId -> [{ date, quantity }] built from the user's real orders
async function loadHistory(userId) {
  const [orderCount, rows] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.orderItem.findMany({
      where: { order: { userId } },
      select: { productId: true, quantity: true, order: { select: { createdAt: true } } },
      orderBy: { order: { createdAt: 'asc' } },
    }),
  ]);

  const byProduct = new Map();
  for (const row of rows) {
    if (!byProduct.has(row.productId)) byProduct.set(row.productId, []);
    byProduct.get(row.productId).push({ date: row.order.createdAt, quantity: row.quantity });
  }
  return { orderCount, byProduct };
}

// Purchases less than a day apart are one shopping trip
function collapseTrips(purchases) {
  const trips = [];
  for (const p of purchases) {
    const last = trips[trips.length - 1];
    if (last && (p.date - last.date) / DAY_MS < SAME_TRIP_DAYS) {
      last.quantity += p.quantity;
      continue;
    }
    trips.push({ date: p.date, quantity: p.quantity });
  }
  return trips;
}

function analyze(trips, now) {
  if (trips.length < MIN_PURCHASES) return null;

  const intervals = [];
  for (let i = 1; i < trips.length; i++) {
    intervals.push((trips[i].date - trips[i - 1].date) / DAY_MS);
  }

  const avg = mean(intervals);
  const sd = Math.sqrt(mean(intervals.map((x) => (x - avg) ** 2)));
  const cv = avg > 0 ? sd / avg : 1;

  const lastDate = trips[trips.length - 1].date;
  const nextExpected = new Date(lastDate.getTime() + avg * DAY_MS);
  const daysUntil = (nextExpected - now) / DAY_MS;
  const daysSinceLast = (now - lastDate) / DAY_MS;

  let status;
  if (daysSinceLast > LAPSED_FACTOR * avg) status = 'lapsed';
  else if (daysUntil < 0) status = 'overdue';
  else if (daysUntil <= DUE_SOON_DAYS) status = 'due-soon';
  else status = 'upcoming';

  let confidence = 'low';
  if (trips.length >= 5 && cv <= 0.3) confidence = 'high';
  else if (cv <= 0.5) confidence = 'medium';

  return {
    status,
    confidence,
    timesPurchased: trips.length,
    avgIntervalDays: round1(avg),
    lastPurchasedAt: lastDate,
    nextExpectedAt: nextExpected,
    daysUntil: round1(daysUntil),
    daysSinceLast,
    typicalQuantity: clamp(Math.round(median(trips.map((t) => t.quantity))), 1, 99),
  };
}

function explain(a) {
  const ago = a.daysSinceLast < 1 ? 'today' : `${daysText(a.daysSinceLast)} ago`;
  let text = `You've bought this ${a.timesPurchased} times, about every ${daysText(a.avgIntervalDays)}. Last bought ${ago}.`;

  if (a.status === 'overdue') {
    text += ' Going by that pattern, you may be running low.';
  } else if (a.status === 'due-soon') {
    text +=
      a.daysUntil < 1
        ? ' Going by that pattern, you may need more today or tomorrow.'
        : ` Going by that pattern, you may need more in about ${daysText(a.daysUntil)}.`;
  } else {
    text += ` Going by that pattern, the next restock is about ${daysText(a.daysUntil)} away.`;
  }

  if (a.confidence === 'low') {
    text += ' Your buying pattern for this item is irregular, so treat this as a rough guide.';
  }
  return text;
}

async function getReorderSuggestions(userId, now = new Date()) {
  const { orderCount, byProduct } = await loadHistory(userId);

  if (orderCount === 0) {
    return {
      orderCount: 0,
      restock: [],
      upcoming: [],
      recent: [],
      message:
        'You have no orders yet. Once you have shopped with us a few times, we will suggest when to restock your regular items.',
    };
  }

  const products = await prisma.product.findMany({ where: { id: { in: [...byProduct.keys()] } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const restock = [];
  const upcoming = [];
  const recent = [];

  for (const [id, purchases] of byProduct) {
    const product = productMap.get(id);
    if (!product) continue; // removed from the catalog

    const trips = collapseTrips(purchases);
    const lastTrip = trips[trips.length - 1];

    recent.push({
      product: productSummary(product),
      lastPurchasedAt: lastTrip.date,
      timesPurchased: trips.length,
      lastQuantity: clamp(lastTrip.quantity, 1, 99),
    });

    const analysis = analyze(trips, now);
    if (!analysis || analysis.status === 'lapsed') continue;

    const { daysSinceLast, ...fields } = analysis;
    const entry = {
      product: productSummary(product),
      ...fields,
      explanation: explain(analysis),
    };
    (analysis.status === 'upcoming' ? upcoming : restock).push(entry);
  }

  restock.sort((a, b) => a.daysUntil - b.daysUntil);
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  recent.sort((a, b) => b.lastPurchasedAt - a.lastPurchasedAt);

  return {
    orderCount,
    restock,
    upcoming,
    recent: recent.slice(0, RECENT_LIMIT),
    message:
      restock.length === 0 && upcoming.length === 0
        ? `We need at least ${MIN_PURCHASES} separate purchases of the same item before we can estimate when you will need it again. Keep shopping and suggestions will appear here. Meanwhile, here are items you bought recently.`
        : undefined,
  };
}

module.exports = { getReorderSuggestions };
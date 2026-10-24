const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { isConfigured } = require('../services/aiService');
const { parseGroceryText, normalizeItems } = require('../services/groceryParser');
const { matchItems } = require('../services/productMatcher');

const MAX_TEXT = 1000;

function summarize(items) {
  const count = (status) => items.filter((i) => i.status === status).length;
  return {
    total: items.length,
    matched: count('matched'),
    ambiguous: count('ambiguous'),
    unmatched: count('unmatched'),
  };
}

const status = asyncHandler(async (req, res) => {
  res.json({ success: true, available: isConfigured() });
});

// Typed list -> Gemini -> structured items -> catalog matches
const parseList = asyncHandler(async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) throw new HttpError(400, 'Enter your grocery list first');
  if (text.length > MAX_TEXT) {
    throw new HttpError(400, `Your list is too long (maximum ${MAX_TEXT} characters)`);
  }

  const parsed = await parseGroceryText(text);
  const items = await matchItems(parsed.items);

  res.json({
    success: true,
    items,
    summary: summarize(items),
    skipped: parsed.skipped,
    truncated: parsed.truncated,
    message:
      items.length === 0
        ? 'We could not find any grocery items in that text. Try listing items like "2 litres milk, 1 kg rice".'
        : undefined,
  });
});

// No AI involved: match (possibly user-edited) items against the catalog.
const matchItemsHandler = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body?.items) || req.body.items.length === 0) {
    throw new HttpError(400, 'Provide a non-empty items array');
  }

  const { items: clean, skipped, truncated } = normalizeItems({ items: req.body.items });
  if (clean.length === 0) throw new HttpError(400, 'No valid items provided');

  const items = await matchItems(clean);
  res.json({ success: true, items, summary: summarize(items), skipped, truncated });
});

module.exports = { status, parseList, matchItemsHandler };
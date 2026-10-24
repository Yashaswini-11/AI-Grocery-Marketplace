const UNIT =
  '(?:kgs?|kilos?|kilograms?|gms?|grams?|g|litres?|liters?|ltr|l|ml|pcs?|pieces?|packets?|packs?|dozens?)';

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

const INTRO = /^(?:i\s+(?:need|want)|please\s+(?:add|get)|add|get|buy)\s+/i;

const ITEM_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\\s*(?:a\\s+)?(${UNIT}\\b)?\\s*(?:of\\s+)?(.+)$`,
  'i'
);

export function parseListLocally(text) {
  const parts = text
    .split(/[,;\n]+|\s+and\s+|\s+&\s+/i)
    .map((s) => s.trim().replace(INTRO, '').replace(/[.!]+$/, '').trim())
    .filter(Boolean);

  const items = [];

  for (const part of parts) {
    const m = part.match(ITEM_RE);
    if (m) {
      const word = m[1].toLowerCase();
      const quantity = NUMBER_WORDS[word] ?? parseFloat(word);
      items.push({
        name: m[3].trim().slice(0, 80),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        unit: m[2] ? m[2].toLowerCase() : null,
        originalText: part.slice(0, 200),
      });
    } else {
      items.push({ name: part.slice(0, 80), quantity: null, unit: null, originalText: part.slice(0, 200) });
    }
  }

  return items.slice(0, 40);
}
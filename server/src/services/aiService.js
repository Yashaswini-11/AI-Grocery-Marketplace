const { GoogleGenAI } = require('@google/genai');
const HttpError = require('../utils/HttpError');
const { geminiApiKey, geminiModel, geminiFallbackModel } = require('../config/env');

const ATTEMPT_TIMEOUT_MS = 12000;
const TOTAL_DEADLINE_MS = 40000;
const PRIMARY_RETRIES = 1;
const FALLBACK_RETRIES = 0;
const BASE_DELAY_MS = 800;

const fallbackModel =
  geminiFallbackModel &&
  geminiFallbackModel.toLowerCase() !== 'none' &&
  geminiFallbackModel !== geminiModel
    ? geminiFallbackModel
    : null;

class AiServiceError extends HttpError {
  constructor(errorCode, message, { status = 502, retryable = false, fallbackable = false } = {}) {
    super(status, message);
    this.name = 'AiServiceError';
    this.errorCode = errorCode;
    this.retryable = retryable; // worth retrying the same model
    this.fallbackable = fallbackable; // worth trying the fallback model
    this.expose = true; // messages are safe to show to users
  }
}

let client = null;

function isConfigured() {
  return Boolean(geminiApiKey);
}

function getClient() {
  if (!geminiApiKey) {
    throw new AiServiceError(
      'AI_NOT_CONFIGURED',
      'AI shopping is not set up on this server. You can still search and add products manually.',
      { status: 503 }
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey: geminiApiKey });
  return client;
}

function classify(err) {
  if (err instanceof AiServiceError) return err;

  const status = Number(err?.status);
  const message = String(err?.message || '');

  if (status === 429) {
    return new AiServiceError(
      'AI_RATE_LIMITED',
      'The AI service is handling too many requests right now. Please try again in a minute.',
      { status: 503, retryable: true, fallbackable: true }
    );
  }
  if ([500, 502, 503, 504].includes(status)) {
    return new AiServiceError(
      'AI_OVERLOADED',
      'The AI service is busy at the moment. Please try again shortly.',
      { status: 503, retryable: true, fallbackable: true }
    );
  }
  if (status === 404) {
    return new AiServiceError(
      'AI_MODEL_UNAVAILABLE',
      'The AI model is currently unavailable. Please try again later.',
      { status: 503, fallbackable: true }
    );
  }
  if (status === 401 || status === 403 || (status === 400 && /api key|API_KEY/i.test(message))) {
    return new AiServiceError(
      'AI_AUTH',
      'AI shopping is temporarily unavailable. You can still search and add products manually.',
      { status: 502 }
    );
  }
  if (status === 400) {
    return new AiServiceError(
      'AI_BAD_REQUEST',
      'The AI service could not process this input. Please check it and try again.',
      { status: 422 }
    );
  }
  if (Number.isFinite(status)) {
    return new AiServiceError(
      'AI_ERROR',
      'The AI service could not complete the request. Please try again.',
      { status: 502 }
    );
  }
  // No HTTP status: network failure (DNS, reset, offline)
  return new AiServiceError(
    'AI_NETWORK',
    'Could not reach the AI service. Please check your connection and try again.',
    { status: 503, retryable: true, fallbackable: true }
  );
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new AiServiceError('AI_TIMEOUT', 'The AI service took too long to respond. Please try again.', {
            status: 504,
            retryable: true,
            fallbackable: true,
          })
        ),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callModel(ai, model, systemInstruction, parts) {
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: { systemInstruction, responseMimeType: 'application/json' },
    }),
    ATTEMPT_TIMEOUT_MS
  );

  const text = response?.text;
  if (!text || !text.trim()) {
    throw new AiServiceError(
      'AI_BAD_RESPONSE',
      'The AI service returned an empty answer. Please try again.',
      { status: 502 }
    );
  }
  return text;
}

// Sends `parts` to Gemini and returns { text, model }. Throws AiServiceError on failure.
async function generateJson({ systemInstruction, parts }) {
  const ai = getClient();
  const started = Date.now();

  const models = [{ name: geminiModel, retries: PRIMARY_RETRIES }];
  if (fallbackModel) models.push({ name: fallbackModel, retries: FALLBACK_RETRIES });

  let lastError = null;

  for (const { name, retries } of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (lastError && Date.now() - started > TOTAL_DEADLINE_MS) throw lastError;

      try {
        const text = await callModel(ai, name, systemInstruction, parts);
        return { text, model: name };
      } catch (raw) {
        const err = classify(raw);
        lastError = err;
        console.error(
          `[ai] ${name} attempt ${attempt + 1}/${retries + 1} failed: ${err.errorCode} ` +
            `(status ${raw?.status ?? 'n/a'}) ${String(raw?.message || '').slice(0, 200)}`
        );

        if (!err.retryable || attempt === retries) break;

        const delay = BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 300);
        await sleep(delay);
      }
    }

    if (!lastError.fallbackable) throw lastError;
  }

  throw lastError;
}

module.exports = { generateJson, isConfigured, AiServiceError };
# FreshCart: AI-Powered Grocery Marketplace

A full-stack grocery e-commerce app. Users browse products, manage a persistent cart, check out with Cash on Delivery, convert a typed grocery list into a cart with Gemini, and get explainable "time to restock" suggestions based on their own order history.

## Features

- **Auth:** register, login and logout with JWT; bcrypt-hashed passwords; protected routes.
- **Catalog:** 27 seeded products across 6 categories, search (including aliases such as "kela" for banana) and category filter.
- **Cart:** persisted in MongoDB per user; stock-checked; totals always computed on the server.
- **Checkout and orders:** Cash on Delivery. Stock reduction, order creation and cart clearing happen in a single MongoDB transaction. Orders store price and name snapshots. Duplicate submits are prevented with an idempotency key. Users can only see their own orders.
- **AI grocery list:** Gemini extracts items and quantities from free text. Items are matched to the real catalog with text normalization and fuzzy matching (no embeddings). Prices and stock always come from the database. Unmatched and ambiguous items stay visible and can be resolved by choosing a suggestion or searching. If the AI is unavailable, the page offers "Match without AI" and manual search, and the rest of the shop is unaffected.
- **Reorder predictions:** average purchase interval per product, calculated from real orders. Needs at least 3 distinct purchases of a product; no prediction is shown with less data. A daily `node-cron` job finds users with items due (see Limitations).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, JavaScript, Tailwind CSS |
| Backend | Node.js, Express, REST |
| Database | MongoDB Atlas, Mongoose |
| Auth | JWT, bcryptjs |
| AI | Google Gemini via `@google/genai` (isolated in one service module) |
| Scheduling | node-cron |
| Payments | Cash on Delivery (the order model leaves room for online payment methods) |

## Project structure

```text
ai-grocery-marketplace/
├── client/                      Next.js frontend
│   ├── app/                     pages: /, login, register, products/[id], cart,
│   │                            checkout, orders, orders/[id], ai, restock
│   ├── components/              Navbar, ProductCard, ProductPicker, AiReviewRow, ...
│   └── lib/                     api client, auth/cart/toast contexts, helpers
├── server/
│   └── src/
│       ├── config/              env + database connection
│       ├── models/              User, Product, Cart, Order
│       ├── controllers/         request handlers
│       ├── routes/              route definitions
│       ├── middleware/          auth, error handling, AI rate limit
│       ├── services/            aiService, groceryParser, productMatcher,
│       │                        cartService, orderService, reorderService
│       ├── jobs/                reorder reminder cron job
│       └── scripts/             seed and developer tools
└── README.md
```

## Getting started

### Prerequisites

- Node.js 20.9 or newer (an LTS release such as 24 is recommended)
- A MongoDB Atlas cluster (the free tier is enough)
- Optional: a Gemini API key from https://aistudio.google.com/apikey

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env: MONGODB_URI, JWT_SECRET (and GEMINI_API_KEY if you want AI)
npm run seed                # loads 27 products (replaces the products collection)
npm run dev                 # http://localhost:5000
```

Check `http://localhost:5000/api/health`. It should report `database: connected`.

### 2. Frontend

```bash
cd client
npm install
cp .env.local.example .env.local     # Windows PowerShell: Copy-Item .env.local.example .env.local
npm run dev                          # http://localhost:3000
```

Register an account on the site and start shopping.

## Environment variables

**server/.env**

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string, including the database name |
| `JWT_SECRET` | yes | Long random string used to sign tokens |
| `CLIENT_URL` | no | Allowed frontend origin(s) for CORS, comma-separated (default `http://localhost:3000`) |
| `PORT` | no | Default 5000 (hosting platforms set this themselves) |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `GEMINI_API_KEY` | no | Without it the AI list is disabled; the rest of the app works |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | no | Primary and fallback model names; set the fallback to `none` to disable it |
| `REMINDER_JOB`, `REMINDER_CRON`, `REMINDER_TZ` | no | Reminder job on/off, schedule (default 09:00 daily) and time zone (default Asia/Kolkata) |
| `DNS_SERVERS` | no | e.g. `8.8.8.8,1.1.1.1`, if your network blocks `mongodb+srv://` lookups |

**client/.env.local**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the API, ending in `/api` |

## Scripts (server)

| Command | Purpose |
|---|---|
| `npm run dev` | Start with auto-restart on code changes (not on `.env` changes) |
| `npm start` | Start for production |
| `npm run seed` | Replace the products collection with the seed catalog |
| `npm run ai-check` | Smoke-test the Gemini key, model and parsing |
| `npm run seed-history -- <email> [--clear]` | Create (or remove) backdated demo orders to try restock predictions |
| `npm run reminders-run` | Run the restock reminder job once |
| `npm run order-status -- <orderId> "<status>"` | Advance an order's status (there is no admin UI) |

## API overview

All responses are JSON. Errors look like `{ "success": false, "error": { "message": "...", "code": "..." } }`.

| Method and path | Auth | Description |
|---|---|---|
| `GET /api/health` | no | Service and database status |
| `POST /api/auth/register`, `POST /api/auth/login` | no | Returns a JWT and the user |
| `GET /api/auth/me` | yes | Current user |
| `GET /api/products` | no | List with `category`, `q`, `page` and `limit` |
| `GET /api/products/search?q=` | no | Search by name or alias |
| `GET /api/products/:id` | no | Product details |
| `GET /api/cart` | yes | Cart with server-computed totals |
| `POST /api/cart/items` | yes | `{ productId, quantity }` (quantities add up) |
| `PATCH /api/cart/items/:productId` | yes | `{ quantity }` |
| `DELETE /api/cart/items/:productId` | yes | Remove an item |
| `POST /api/orders` | yes | `{ delivery, paymentMethod: "COD" }`; optional `Idempotency-Key` header |
| `GET /api/orders`, `GET /api/orders/:id` | yes | The user's own orders only |
| `GET /api/ai/status` | no | Whether AI is configured |
| `POST /api/ai/parse-list` | yes | `{ text }`; Gemini plus catalog matching (10 requests per minute per user) |
| `POST /api/ai/match-items` | yes | `{ items }`; catalog matching only, no AI |
| `GET /api/reorder/suggestions` | yes | Restock suggestions from order history |

## Design notes

- **Server owns the numbers.** Prices, stock and totals are always read from the database. The AI never supplies them.
- **Safe checkout.** Each stock decrement is conditional (`stock >= quantity`) inside a transaction, so two buyers can't oversell the last item and a failed order leaves no partial changes.
- **AI isolation.** `aiService.js` is the only file that knows about Gemini. It does limited retries with exponential backoff, a per-attempt timeout, and a fallback model. `groceryParser.js` validates the model's JSON. `productMatcher.js` works without any AI.
- **Quantities.** The cart takes whole units (1 to 99). A request like "500 g paneer" is rounded up to 1 kg with a visible note, and incompatible units are flagged for review.
- **Predictions.** Purchases less than a day apart count as one shopping trip. Items bought fewer than 3 times get no estimate, and items not bought for 3 times their usual interval are treated as lapsed.

## Deployment (summary)

- **Database:** MongoDB Atlas. Use a separate database name for production (for example `grocery_prod`).
- **Backend (e.g. Render):** root directory `server`, build `npm install`, start `npm start`, health check `/api/health`. Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (the frontend URL), and optionally the Gemini variables.
- **Frontend (e.g. Vercel):** root directory `client`; set `NEXT_PUBLIC_API_URL` to `https://<your-api-host>/api` before building.
- Seed the production database once: set `MONGODB_URI` to the production string in your terminal, then run `npm run seed` in `server`.

## Known limitations

- **Cash on Delivery only.** Online payments are not integrated.
- **Image input for grocery lists is not implemented yet.**
- **Reminders only write a log line.** No email or SMS provider is connected. On hosting that sleeps when idle, the daily job won't run.
- **No admin interface.** Order status is changed with a script.
- **JWT is kept in `localStorage`,** which is simple but exposed to XSS; an httpOnly cookie would be the next hardening step.
- **The AI rate limit is in memory,** so it resets on restart and isn't shared across multiple server instances.
- **Login attempts are not rate limited.**
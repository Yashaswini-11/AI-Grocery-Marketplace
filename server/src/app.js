const express = require('express');
const cors = require('cors');
const { clientUrl } = require('./config/env');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const aiRoutes = require('./routes/aiRoutes');
const reorderRoutes = require('./routes/reorderRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// CLIENT_URL may hold several origins separated by commas (e.g. production + preview)
const allowedOrigins = clientUrl
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind a hosting proxy

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, server-to-server) are allowed
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reorder', reorderRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
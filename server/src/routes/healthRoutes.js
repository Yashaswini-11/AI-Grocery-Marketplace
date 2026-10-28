const express = require('express');
const { prisma } = require('../config/db');

const router = express.Router();

// Used by hosting health checks: confirms the API can really reach the database
router.get('/', async (req, res) => {
  let connected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
  } catch {
    connected = false;
  }

  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

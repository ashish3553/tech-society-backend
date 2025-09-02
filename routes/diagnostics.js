// routes/diagnostics.js
const router = require('express').Router();
const mongoose = require('mongoose');

async function timed(fn) {
  const t0 = Date.now();
  try {
    const data = await fn();
    return { ok: true, ms: Date.now() - t0, data };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e.message || String(e) };
  }
}

router.get('/', async (req, res) => {
  const deep = req.query.deep === '1' || req.query.deep === 'true';

  // Mongo ping
  const mongo = await timed(async () => {
    const state = mongoose.connection.readyState; // 1 connected, 2 connecting
    let ping;
    if (state === 1 && mongoose.connection.db) {
      ping = await mongoose.connection.db.admin().ping();
    }
    return { state, ping };
  });

  // Piston ping (disabled if no URL)
  const piston = await timed(async () => {
    const url = process.env.PISTON_URL;
    if (!url) throw new Error('PISTON_URL not set');
    // try both root and /runtimes; pick whichever succeeds first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const r = await fetch(url, { signal: controller.signal });
      const text = await r.text();
      return { status: r.status, ok: r.ok, sample: text.slice(0, 200) };
    } finally { clearTimeout(timeout); }
  });

  // CORS preview (what we’ll allow)
  const allowFrom = [
    'http://localhost:3000',
    'http://localhost:5173',
    '*.vercel.app',
    '*.railway.app',
    '*.practicearena.com',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : [])
  ];

  const summary = {
    service: 'tech-society-backend',
    now: new Date().toISOString(),
    node: process.version,
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '5000',
      CLIENT_URL: process.env.CLIENT_URL || null,
      PISTON_URL: process.env.PISTON_URL || null
    },
    deps: { mongo, piston },
    corsAllowPreview: allowFrom
  };

  // Optional deeper checks (add more here if you want)
  if (deep) {
    // Example: try code-exec via your own route if mounted
    summary.deep = {};
    summary.deep.codeExecLanguages = await timed(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const base = `${req.protocol}://${req.get('host')}`;
        const r = await fetch(`${base}/api/code-exec/languages`, { signal: controller.signal });
        return { status: r.status, ok: r.ok, sample: (await r.text()).slice(0, 200) };
      } finally { clearTimeout(timeout); }
    });
  }

  res.status(200).json(summary);
});

module.exports = router;

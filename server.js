require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

app.disable('x-powered-by');

// Only trust proxy headers when explicitly configured (nginx/cloudflare)
// On direct Windows/RDP deployment leave this off to avoid IP spoofing issues
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  next();
});

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

/* ── Prevent all API responses from being cached by browser/proxy ──
   Critical for remote desktop / corporate networks where GET requests
   get cached by IE/Edge/HTTP.sys — causing stale data after writes */
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/* ── General API rate limiter (per authenticated user, per minute) ── */
const _apiRateStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _apiRateStore) if (now > v.resetAt) _apiRateStore.delete(k);
}, 2 * 60 * 1000);

function apiRateLimit(maxPerMinute) {
  return (req, res, next) => {
    // Only rate-limit authenticated sessions; login route has its own limiter
    const key = req.session?.user?.id || req.ip;
    const now = Date.now();
    const entry = _apiRateStore.get(key) || { count: 0, resetAt: now + 60_000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
    entry.count++;
    _apiRateStore.set(key, entry);
    if (entry.count > maxPerMinute) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

/* ── Idle session timeout (30 minutes of inactivity) ── */
const SESSION_IDLE_MS  = 30 * 60 * 1000;
const SESSION_TOUCH_MS =  5 * 60 * 1000;  // only write session if ≥5 min since last touch
function touchSession(req, res, next) {
  if (req.session?.user) {
    const now = Date.now();
    const last = req.session._lastActivity || now;
    if (now - last > SESSION_IDLE_MS) {
      return req.session.destroy(() => res.status(401).json({ error: 'Session expired due to inactivity' }));
    }
    // Only dirty the session (triggering a write) every 5 minutes
    if (now - last > SESSION_TOUCH_MS) {
      req.session._lastActivity = now;
    }
  }
  next();
}


const _sessionSecret = process.env.SESSION_SECRET || (function() {
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET env var required in production');
  console.warn('\n⚠️  SESSION_SECRET not set — using insecure dev default.\n');
  return 'dev-only-insecure-secret-change-me';
}());

app.use(session({
  secret: _sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    httpOnly: true,
    // secure:true only when explicitly set — allows HTTP on remote desktop / LAN
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
  },
}));

app.use(express.static(path.join(__dirname, 'public')));
// Touch session activity timestamp on every authenticated API request
app.use('/api', touchSession);
// General rate limit: 200 requests/min per user across all API routes
// Managers/admins hit more endpoints (overview, analytics, feed, employees)
app.use('/api', apiRateLimit(200));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/standup',       require('./routes/standup'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/export',        require('./routes/export'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/productivity',  require('./routes/productivity'));

app.get('*', function(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

/* ── AUTO-APPROVE LEAVES (72 h) ── */
const db = require('./db/database');
const AUTO_APPROVE_HOURS = 72;
const AUTO_APPROVE_INTERVAL_MS = 30 * 60 * 1000;

async function autoApproveStaleLeaves() {
  try {
    const cutoff = new Date(Date.now() - AUTO_APPROVE_HOURS * 3600000)
      .toISOString().replace('T', ' ').slice(0, 19);
    const stale = await db.prepare(
      `SELECT l.id, l.user_id, l.date FROM leaves l
       WHERE l.approved=0 AND l.created_at<=?
         AND (CAST(strftime('%w',l.date) AS INTEGER) BETWEEN 1 AND 5
           OR l.date IN (SELECT date FROM working_saturdays))
         AND l.date NOT IN (SELECT date FROM holidays)`
    ).all(cutoff);
    for (const leave of stale) {
      await db.prepare(`UPDATE leaves SET approved=1,approver_id='system',approved_at=CURRENT_TIMESTAMP WHERE id=?`).run(leave.id);
      await db.prepare(`INSERT INTO notifications (user_id,type,title,body,link_view) VALUES (?,?,?,?,?)`).run(
        leave.user_id, 'leave_approved', '✅ Leave Auto-Approved',
        `Your leave on ${leave.date} was automatically approved after ${AUTO_APPROVE_HOURS}h.`, 'leave'
      );
    }
  } catch (e) { console.error('[auto-approve]', e.message); }
}

async function pruneOldNotifications() {
  try {
    // Keep only the 100 most recent notifications per user using ROW_NUMBER window function
    await db.prepare(
      `DELETE FROM notifications WHERE id IN (
         SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
           FROM notifications
         ) ranked WHERE rn > 100
       )`
    ).run();
  } catch (e) { console.error('[prune-notif]', e.message); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StandupPro v11 running at http://localhost:${PORT}`);
  console.log('First time setup: node seed.js');
  autoApproveStaleLeaves();
  setInterval(autoApproveStaleLeaves, AUTO_APPROVE_INTERVAL_MS);
  pruneOldNotifications();
  setInterval(pruneOldNotifications, 24 * 3600 * 1000);
});

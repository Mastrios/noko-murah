require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const ErrorLogger = require('./services/error_logs');
const ApiError = require('./config/api_error');
//const restoreUserSession = require('./middleware/authMiddleware'); // <-- IMPORT MIDDLEWARE PEMULIHAN SESI
const ngrok = require("@ngrok/ngrok");

const PORT = process.env.PORT;
// --- DEBUGGER REQUEST NYANGKUT ---
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  res.once('finish', () => {
    console.log(`[RES] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now()-start}ms`);
  });
  next();
});

// Middleware dasar
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Header Keamanan Pengaman Pop-up Google Auth
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// --- PENGATURAN SESSION (DIAMANKAN UNTUK PROXY / ZROK / NGROK) ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'nokos_panel_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,       // Ngrok HTTPS → boleh false, session tetap jalan
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}));

// --- PASANG MIDDLEWARE PEMULIHAN SESI OTOMATIS ---
//app.use(restoreUserSession);

// Set View Engine (EJS) & Folder Statis agar Publik (JS/CSS) bisa diakses
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// --- IMPORT & PASANG ROUTES ---
const index = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
// const adminRoutes = require('./routes/adminRoutes');
app.use('/', index);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/webhook', webhookRoutes);
// app.use('/admin', adminRoutes);


// ==========================================================
// 🚨 1. MIDDLEWARE 404 NOT FOUND
// ==========================================================
app.use((req, res, next) => {
  const err = new ApiError(404, 'Halaman tidak ditemukan di index.');
  next(err);
});


// ==========================================================
// 🛡️ 2. GLOBAL ERROR HANDLING MIDDLEWARE
// ==========================================================
app.use(async (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const publicMessage = err.isOperational 
    ? err.message 
    : 'Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.';

  if (statusCode !== 404) {
    await ErrorLogger.log(err, req);
  }

  const isAjaxOrApi = 
    req.xhr || 
    req.path.startsWith('/api') || 
    req.path.startsWith('/auth/') || 
    req.headers['content-type']?.includes('application/json') ||
    req.headers['accept']?.includes('application/json');

  if (isAjaxOrApi) {
    return res.status(statusCode).json({
      success: false,
      status: statusCode,
      message: publicMessage
    });
  } else {
    return res.status(statusCode).render('error', {
      statusCode: statusCode,
      message: publicMessage
    });
  }
});
// Jalankan Server & Inisialisasi Ngrok Tunnel (Hanya di Lokal/Termux)
app.listen(PORT, async () => {
  console.log(`Server aktif di http://localhost:${PORT}`);

  const isVercel = process.env.VERCEL === '1';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isVercel || isProduction) {
    console.log("Production mode. Ngrok dilewati.");
    return;
  }

  try {
    console.log("Menghubungkan ke Ngrok...");
    const forwarder = await ngrok.forward({
      addr: PORT,
      authtoken: process.env.NGROK_AUTHTOKEN,
      domain: "scone-compile-poser.ngrok-free.dev", // aktifkan hanya jika yakin
      onStatusChange: (status, err) => {
        console.log(`[NGROK] ${status}`, err ? `| err: ${err}` : '');
      },
    });

    console.log(`Ngrok aktif: ${forwarder.url()}`);

    // Keep-alive TANPA block stdin
    const keepAlive = setInterval(() => {}, 1 << 30);

    const shutdown = async () => {
      console.log('\nShutting down...');
      clearInterval(keepAlive);
      try { await forwarder.close(); } catch (_) {}
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error("[NGROK ERROR]", error);
  }
});

// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const index = require('../controllers/indexController'); // Nanti logic-nya ditaruh di controller

// 1. Rute untuk Login / Autentikasi via Telegram Mini App
router.get('/', index.indexHome);
router.get('/notification', index.notif);
router.get('/p/privacy', index.privacy);
router.get('/p/term', index.term);

// Admin Telegram
router.get('/ad/logger', index.adminLogger);
// Telegram
router.get('/t/dashboard/:telegramId', index.telegramDash);
router.get('/t/topup/:telegramId', index.telegramTopUp);
router.get('/t/profil/:telegramId', index.telegramProfile);
router.get('/t/riwayat-order/:telegramId', index.telegramRiwayatOrder);
router.get('/t/notification', index.telegramNotif);
module.exports = router;

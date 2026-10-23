// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const webhook = require('../controllers/webhookController'); // Nanti logic-nya ditaruh di controller

// 1. Rute untuk Login / Autentikasi via Telegram Mini App
router.post('/telegram', webhook.telegramWebhook);
router.post('/midtrans', webhook.midtransWebhook);
module.exports = router;

// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// TELEGRAM MINI APP
router.get('/telegram', (req, res, next) => authController.loginTelegram(req, res, next));
router.post('/masuk', (req, res, next) => authController.loginManual(req, res, next));
router.post('/daftar', (req, res, next) => authController.registerManual(req, res, next));

// ==========================================
// RUTE SESI & AKUN
// ==========================================

// 3. Rute untuk Cek Sesi User yang Sedang Login
router.get('/me', (req, res, next) => authController.getCurrentUser(req, res, next));

// 4. Logout
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

module.exports = router;

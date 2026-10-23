// middleware/authMiddleware.js
const firestoreService = require('../config/logic_firebase');

async function restoreUserSession(req, res, next) {
    try {
        // 1. Cek jika sesi Express sudah ada
        if (req.session && req.session.userId) {
            let user = await firestoreService.getByField('users', 'uid', req.session.userId);
            if (user) {
                req.user = user;
                res.locals.user = user;
                return next();
            }
        }

        // 2. Jika sesi hilang (karena redeploy), cek apakah ada kiriman telegramId 
        // (Biasanya Telegram Mini App mengirim data user lewat query URL atau header initData)
        let telegramId = req.query.telegramId || req.body;

        // Alternatif: Cek dari initData Telegram WebApp jika dikirim lewat header/query
        if (!telegramId && req.headers['x-telegram-init-data']) {
            // Jika kamu memproses initData Telegram di sini
            // (Opsional, tergantung cara kamu menangkap data initData di web)
        }

        if (telegramId) {
            const strId = String(telegramId);
            let user = await firestoreService.getByField('users', 'telegram.uid', strId);

            if (user && user.isActivated === true) {
                // Pulihkan sesi secara otomatis ke Express Session
                const docId = user.documentId || user.uid;
                req.session.userId = docId;
                req.session.email = user.email;

                // Set ke req & res.locals agar langsung bisa diakses EJS
                req.user = user;
                res.locals.user = user;
                return next();
            }
        }

        // Jika tidak ketemu sama sekali, set user jadi null/undefined
        req.user = null;
        res.locals.user = null;
        next();

    } catch (error) {
        console.error("Gagal memulihkan sesi user:", error);
        req.user = null;
        res.locals.user = null;
        next();
    }
}

module.exports = restoreUserSession;

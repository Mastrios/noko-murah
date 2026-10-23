// commands/start.js
const ApiConfig = require('../config/api_config');
const firestoreService = require('../config/logic_firebase');
const path = require('path');

module.exports = {
    command: '/start',
    async execute(context) {
        const { chatId, telegramId, loggedIn, messageId, dynamicBaseUrl, sendReplyKeyboard, fetch, commandsMap } = context;
        
        const BOT_TOKEN = ApiConfig.TELEGRAM.BOT_TOKEN;
        const strId = String(telegramId);

        // --- JIKA BELUM LOGIN ---
        if (!loggedIn) {
            let userDoc = await firestoreService.getByField('users', 'telegram.uid', strId);

            if (!userDoc) {
                const uid = String(Date.now());
                const newPayload = {
                    uid: uid,
                    name: '',
                    email: '',
                    password: '',
                    telegram: {
                        uid: strId,
                        chatId: chatId
                    },
                    balance: 0,
                    role: 'user',
                    isActivated: false,
                    createdAt: new Date().toISOString()
                };
                await firestoreService.set('users', uid, newPayload);
                userDoc = newPayload;
            }

            let targetUrl = dynamicBaseUrl;
            if (ApiConfig.ENV !== 'production' && ApiConfig.SETTINGS.DOMAIN) {
                targetUrl = ApiConfig.SETTINGS.DOMAIN;
            }

            const inlineKeyboard = {
                inline_keyboard: [
                    [{
                        text: "Masuk / Daftar Akun",
                        web_app: { url: targetUrl + "/auth/telegram" }
                    }]
                ]
            };

            const welcomeText = `<b>ACCESS DENIED</b>
            
<code>Silakan <b>Masuk</b> atau <b>Daftar</b> terlebih dahulu untuk memulai menggunakan layanan ini.</code>`;
            
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: welcomeText,
                    parse_mode: 'HTML',
                    reply_markup: inlineKeyboard
                })
            });
            const result = await response.json();
            
            if (result.ok && result.result) {
                const docId = userDoc.documentId || userDoc.uid;
                userDoc.telegram.chatId = chatId;
                userDoc.telegram.messageId = result.result.message_id;
                await firestoreService.set('users', docId, userDoc);
            }
            return; // Berhenti di sini, pesan /start user TIDAK dihapus
        }

        // --- JIKA SUDAH LOGIN: Hapus pesan /start user agar chat bersih ---
        if (messageId) {
            try {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
                });
            } catch (err) {
                console.error('Gagal menghapus pesan /start user:', err);
            }
        }

        // 1. Kirim & Pin Banner Pengumuman Manual Otomatis di Atas Chat
        /**try {
          
            const dummyMiniAppUrl = dynamicBaseUrl+"/notification"; // Sesuaikan URL mini app kamu nanti

            const bannerText = "📢 <b>INFO PENGUMUMAN </b>\n\nSilakan klik buka untuk melihat <b>PENGUMUMAN</b> dari website kami.";
            
            const bannerKeyboard = {
              inline_keyboard: [
                [{ text: "buka", web_app: { url: dummyMiniAppUrl } }]
              ]
            };

            const sendBannerUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const bannerRes = await fetch(sendBannerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: bannerText,
                    parse_mode: 'HTML',
                    reply_markup: bannerKeyboard
                })
            });
            const bannerData = await bannerRes.json();

            // Jika pesan banner berhasil terkirim, langsung sematkan (pin) ke atas
            if (bannerData.ok && bannerData.result) {
                const pinUrl = `https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`;
                await fetch(pinUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: bannerData.result.message_id,
                        disable_notification: true
                    })
                });
            }
        } catch (pinErr) {
            console.error('Gagal mengirim/menyematkan banner pengumuman:', pinErr);
        }**/

        // 2. Lempar langsung ke command /menu
        const menuCommand = require('./menu');
        if (menuCommand && typeof menuCommand.execute === 'function') {
            await menuCommand.execute(context);
        } else {
            await sendReplyKeyboard(chatId, "<b>⚡ SYSTEM CONNECTED</b>\nSelamat datang kembali!", [[{ text: 'profil' }, { text: 'Daftar Layanan' }]]);
        }
    }
};

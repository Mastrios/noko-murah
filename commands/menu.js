// commands/menu.js
const ApiConfig = require('../config/api_config');
const firestoreService = require('../config/logic_firebase');

module.exports = {
    command: 'menu', 
    async execute({ chatId, telegramId, sendReplyKeyboard, dynamicBaseUrl }) {
        const strId = String(telegramId);
        let userDoc = await firestoreService.getByField('users', 'telegram.uid', strId);
        const saldo = userDoc ? (userDoc.balance || 0) : 0;
        
        // 1. OLAHI DOMAIN UTAMA DENGAN AMAN
        let baseUrl = dynamicBaseUrl || ApiConfig.SETTINGS?.DOMAIN || 'https://buatmu.xyz';
        
        // Hapus trailing slash di akhir URL jika ada (agar concatenation aman)
        baseUrl = baseUrl.replace(/\/+$/, '');

        if (ApiConfig.ENV !== 'production' && ApiConfig.SETTINGS?.DOMAIN) {
            baseUrl = ApiConfig.SETTINGS.DOMAIN.replace(/\/+$/, '');
        }

        // 2. DESAIN PESAN DASHBOARD
        const text = `<b>⚡ NOKOS PANEL - Dashboard</b>
─────────────────────
<i>Silakan pilih menu di bawah, dan selamat menikmati layanan kami. Jika ada masalah, bisa langsung menghubungi admin di bawah.</i>`;

        // 3. REPLY KEYBOARD MATRIX DENGAN WEBAPP URL DEDIKASI
        let keyboardMatrix = []
        keyboardMatrix = [
            [
                { text: 'ORDER NOKOS', web_app: { url: `${baseUrl}/t/dashboard/${telegramId}` } }, 
                { text: 'TOP UP', web_app: { url: `${baseUrl}/t/topup/${telegramId}` } }
            ],
            [
                { text: 'INFORMASI', web_app: { url: `${baseUrl}/t/notification` } }, 
                { text: 'PROFIL', web_app: {url: `${baseUrl}/t/profil/${telegramId}`} }
            ],
            [   { text: 'ADMIN', web_app: { url: `${baseUrl}/t/contact/${telegramId}` } }]
        ];
        if(userDoc.role == "trios"){
          keyboardMatrix = [
            [
              { text : 'LOGGER', web_app: { url: `${baseUrl}/ad/logger`} } ]
          ];
        }
        // 4. KIRIM REPLIK KEYBOARD KE CHAT TELEGRAM
        await sendReplyKeyboard(chatId, text, keyboardMatrix);
    }
};

// commands/saldo.js
const firestoreService = require('../config/logic_firebase');

module.exports = {
    // Cocokkan dengan teks yang ada di tombol
    command: 'profil', 
    async execute({ chatId, telegramId, sendReplyKeyboard }) {
        const strId = String(telegramId);
        let userDoc = await firestoreService.getByField('users', 'telegram.uid', strId);
        const saldo = userDoc ? (userDoc.balance || 0) : 0;

        const text = `<b>💰 INFORMASI SALDO</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━\n<blockquote>Saldo Anda: Rp ${saldo.toLocaleString('id-ID')}</blockquote>`;
        
        const keyboardMatrix = [
            [{ text: 'Top Up' }, { text: 'Back' }]
        ];

        await sendReplyKeyboard(chatId, text, keyboardMatrix);
    }
};

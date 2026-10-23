// service/telegram_bot.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const firestoreService = require('../config/logic_firebase');
const ApiConfig = require('../config/api_config');

const TELEGRAM_BOT_TOKEN = ApiConfig.TELEGRAM.BOT_TOKEN;

// ==========================================
// AUTO-LOAD COMMANDS DARI FOLDER /commands
// ==========================================
const commandsMap = new Map();
const commandsDir = path.join(__dirname, '../commands');

if (fs.existsSync(commandsDir)) {
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const cmdModule = require(path.join(commandsDir, file));
        if (cmdModule.command && typeof cmdModule.execute === 'function') {
            let rawCmd = cmdModule.command;
            const commandList = Array.isArray(rawCmd) ? rawCmd : [rawCmd];

            commandList.forEach(cmd => {
                const cleanName = cmd.replace(/^[\/#\$]/, '').toLowerCase();
                commandsMap.set(`/${cleanName}`, cmdModule);
                commandsMap.set(`#${cleanName}`, cmdModule);
                commandsMap.set(`$${cleanName}`, cmdModule);
                commandsMap.set(`${cleanName}`, cmdModule);
            });
        }
    }
}

// ==========================================
// FUNGSI CEK STATUS LOGIN USER (Berdasarkan isActivated)
// ==========================================
async function isUserLoggedIn(telegramId) {
    try {
        const strId = String(telegramId);
        let user = await firestoreService.getByField("users", "telegram.uid", strId);

        if (!user || user.isActivated !== true) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error mengecek status login:', error);
        return false;
    }
}

// ==========================================
// FUNGSI UTILITY TELEGRAM (Kirim, Edit, Hapus)
// ==========================================

async function sendReplyKeyboard(chatId, text, keyboardMatrix) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: keyboardMatrix,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Error mengirim Reply Keyboard:', error);
    }
}

async function deleteMessage(chatId, messageId) {
    const urlDelete = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    try {
        await fetch(urlDelete, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
    } catch (error) {
        // Abaikan error jika pesan sudah terhapus atau terlalu lama
    }
}

async function deleteAndSendMessage(chatId, messageId, text, keyboardMatrix = null) {
    await deleteMessage(chatId, messageId);

    const urlSend = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };

    if (keyboardMatrix) {
        payload.reply_markup = {
            keyboard: keyboardMatrix,
            resize_keyboard: true,
            one_time_keyboard: false
        };
    }

    try {
        const response = await fetch(urlSend, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Error mengirim pesan baru setelah hapus:', error);
    }
}

async function editMessageText(chatId, messageId, newText, inlineKeyboard = null) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: 'HTML'
    };

    if (inlineKeyboard) {
        payload.reply_markup = inlineKeyboard;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Error mengedit pesan:', error);
    }
}

async function sendInlineKeyboard(chatId, text, inlineKeyboardMatrix) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: inlineKeyboardMatrix
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Error mengirim Inline Keyboard:', error);
    }
}

// ==========================================
// HANDLER UTAMA PESAN MASUK
// ==========================================
async function handleTelegramUpdate(update, dynamicBaseUrl) {
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const rawText = update.message.text.trim();
        const telegramId = update.message.from.id;
        const messageId = update.message.message_id;

        const loggedIn = await isUserLoggedIn(telegramId);

        let cleanText = rawText.toLowerCase();
        cleanText = cleanText.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
        cleanText = cleanText.replace(/^[\/#\$]/, '');
        cleanText = cleanText.trim();

        // Tangani tombol "kembali" atau "menu"
        if (cleanText === 'kembali' || cleanText === 'menu') {
            await deleteMessage(chatId, messageId);
            // Coba hapus juga pesan balasan bot tepat di atasnya jika ada (mengasumsikan messageId - 1 adalah pesan bot)
            await deleteMessage(chatId, messageId - 1);

            const menuModule = commandsMap.get('menu') || commandsMap.get('/menu');
            if (menuModule) {
                try {
                    await menuModule.execute({
                        chatId,
                        telegramId,
                        loggedIn,
                        text: rawText,
                        messageId,
                        dynamicBaseUrl,
                        sendReplyKeyboard,
                        deleteAndSendMessage,
                        editMessageText,
                        fetch
                    });
                } catch (err) {
                    console.error('Error mengeksekusi menu via kembali:', err);
                }
                return;
            }
        }

        let matchedHandler = commandsMap.get(cleanText) || commandsMap.get(`/${cleanText}`);

        if (matchedHandler) {
            try {
                await matchedHandler.execute({
                    chatId,
                    telegramId,
                    loggedIn,
                    text: rawText,
                    messageId,
                    dynamicBaseUrl,
                    sendReplyKeyboard,
                    deleteAndSendMessage,
                    editMessageText,
                    fetch
                });
            } catch (err) {
                console.error(`Error mengeksekusi handler untuk "${rawText}":`, err);
            }
            return;
        }

        // FALLBACK JIKA PERINTAH TIDAK DIKENALI
        // Hapus pesan user yang mengetik perintah salah
        await deleteMessage(chatId, messageId);

        if (!loggedIn) {
            const cmdStart = commandsMap.get('start') || commandsMap.get('/start');
            if (cmdStart) {
                await cmdStart.execute({ chatId, telegramId, loggedIn, messageId, dynamicBaseUrl, sendReplyKeyboard, deleteAndSendMessage, editMessageText, fetch });
            }
        } else {
            // Menggunakan deleteAndSendMessage untuk menghapus pesan bot sebelumnya (messageId - 1) sekaligus mengirim pesan baru dengan tombol "Kembali"
            await deleteAndSendMessage(
                chatId, 
                messageId - 1, 
                "⚠️ Maaf, perintah atau menu tersebut tidak dikenali. Silakan klik tombol di bawah untuk kembali ke menu utama:", 
                [
                    [{ text: 'Kembali' }]
                ]
            );
        }
    }
}

async function triggerMenuCommand(chatId, telegramId) {
    const menuModule = commandsMap.get('menu') || commandsMap.get('/menu');
    if (menuModule && typeof menuModule.execute === 'function') {
        try {
            await menuModule.execute({
                chatId,
                telegramId,
                loggedIn: true,
                text: 'menu',
                sendReplyKeyboard,
                deleteAndSendMessage,
                editMessageText,
                fetch
            });
            return true;
        } catch (error) {
            console.error('Gagal mentrigger menu otomatis:', error);
            return false;
        }
    }
    return false;
}

module.exports = {
    sendReplyKeyboard,
    deleteAndSendMessage,
    editMessageText,
    sendInlineKeyboard,
    handleTelegramUpdate,
    triggerMenuCommand,
    isUserLoggedIn
};

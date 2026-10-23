const ApiConfig = require('../config/api_config');
const firestoreService = require('../config/logic_firebase');
const ApiError = require('../config/api_error');   
const bcrypt = require('bcryptjs'); 
const telegram = require('../services/telegram_bot'); // Perbaikan path folder service

class AuthController {

  async loginTelegram(req, res, next) {
    try {
      const settingsList = await firestoreService.getAll("settings");
      const settings = settingsList[0] || {};
      
      const isRegistrationOpen = settings.registration_open ?? true; 
      const brandName = settings.brand || "Nokos Panel";
      const adminUsername = settings.admin_telegram || "AdminUsernameKamu"; 
      
      return res.status(200).render("telegram/login", {
        brand_name: brandName,
        isRegistrationOpen: isRegistrationOpen,
        bot_admin_username: adminUsername
      });
    } catch (err) {
      next(err);
    }
  }

  async registerManual(req, res, next) {
    try {
      const { name, email, password, telegramId } = req.body;

      if (!name || !email || !password) {
        throw ApiError.badRequest('Semua kolom wajib diisi!');
      }

      const existingUser = await firestoreService.getByField('users', 'email', email);
      if (existingUser) {
        throw ApiError.badRequest('Email sudah terdaftar. Silakan gunakan email lain atau masuk.');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const strId = telegramId ? String(telegramId) : null;
      let userDoc = null;
      if (strId) {
        userDoc = await firestoreService.getByField('users', 'telegram.uid', strId);
      }

      const docId = userDoc ? (userDoc.documentId || userDoc.uid) : String(Date.now());
      
      const userPayload = {
        uid: userDoc?.uid || docId,
        name: name,
        email: email,
        password: hashedPassword,
        telegram: {
          uid: strId,
          chatId : userDoc?.telegram?.chatId || null,
          messageId: userDoc?.telegram?.messageId || null
        },
        balance: userDoc?.balance || 0,
        role: 'user',
        isActivated: true,
        createdAt: userDoc?.createdAt || new Date().toISOString()
      };
    
      await firestoreService.set('users', docId, userPayload);

      // Simpan data user ke req.user
      req.session.user = userPayload;

      if (req.session) {
        req.session.userId = docId;
        req.session.email = email;
      }

      if (telegramId) {
        try {
          const chatId = userDoc?.telegram?.chatId;
          const messageId = userDoc?.telegram?.messageId;

          // Hapus pesan auth/login lama jika ada
          if (chatId && messageId) {
            try {
              await telegram.deleteMessage ? telegram.deleteMessage(chatId, messageId) : fetch(`https://api.telegram.org/bot${ApiConfig.TELEGRAM.BOT_TOKEN}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: messageId })
              });
            } catch (e) {
              // Abaikan jika gagal hapus
            }
          }

          // Otomatis kirim pesan menu utama via bot Telegram
          if (chatId && typeof telegram.triggerMenuCommand === 'function') {
            await telegram.triggerMenuCommand(chatId, strId);
          }
        } catch (telegramErr) {
          console.error("Gagal memproses pesan Telegram:", telegramErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Pendaftaran berhasil! Akun telah dibuat.',
        redirectTo: '/menu'
      });

    } catch (error)  {
      next(error);
    }
  }

  async loginManual(req, res, next) {
    try {
      const { email, password, telegramId } = req.body;
      
      if (!email || !password) {
        throw ApiError.badRequest('Email dan password wajib diisi!');
      }

      const userData = await firestoreService.getByField('users', 'email', email);
      if (!userData) {
        throw ApiError.badRequest('Email atau password salah.');
      }

      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        throw ApiError.badRequest('Email atau password salah.');
      }

      const docId = userData.documentId || userData.uid;
      const strId = telegramId ? String(telegramId) : null;

      if (strId) {
        userData.telegram = userData.telegram || {};
        userData.telegram.uid = strId;
        userData.isActivated = true;
        await firestoreService.set('users', docId, userData);
      }

      // Simpan data user ke req.user
      req.session.user = userData;

      if (req.session) {
        req.session.userId = docId;
        req.session.email = userData.email;
      }

      if (telegramId) {
        try {
          const chatId = userData.telegram?.chatId;
          const messageId = userData.telegram?.messageId;

          // Hapus pesan auth/login lama jika ada
          if (chatId && messageId) {
            try {
              await telegram.deleteMessage ? telegram.deleteMessage(chatId, messageId) : fetch(`https://api.telegram.org/bot${ApiConfig.TELEGRAM.BOT_TOKEN}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: messageId })
              });
            } catch (e) {
              // Abaikan jika gagal hapus
            }
          }

          // Otomatis kirim pesan menu utama via bot Telegram
          if (chatId && typeof telegram.triggerMenuCommand === 'function') {
            await telegram.triggerMenuCommand(chatId, strId);
          }
        } catch (telegramErr) {
          console.error("Gagal memproses pesan Telegram:", telegramErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Login Berhasil!',
        redirectTo: '/menu'
      });

    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Sesi habis atau belum login.'
        });
      }

      const userData = await firestoreService.getByField('users', 'uid', userId);
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna tidak ditemukan.'
        });
      }

      // Simpan ke req.user jika diakses via middleware
      req.user = userData;

      return res.status(200).json({
        success: true,
        user: {
          name: userData.name,
          email: userData.email,
          balance: userData.balance || 0,
          role: userData.role || 'user',
          telegramId: userData.telegram?.uid || null
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) throw ApiError.internal('Gagal menghancurkan sesi.');
        });
      }

      res.clearCookie('connect.sid'); 

      return res.status(200).json({
        success: true,
        message: 'Berhasil keluar dari akun.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();

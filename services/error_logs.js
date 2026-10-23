// services/error_logs.js
const firestoreService = require('../config/logic_firebase'); // Menggunakan class FirestoreService kamu

class ErrorLogger {
  static async log(err, req = null) {
    try {
      const errorData = {
        message: err.message,
        rawError: err.rawError || err.stack || 'Unknown error',
        statusCode: err.statusCode || 500,
        path: req ? req.originalUrl : 'SYSTEM / BOT',
        method: req ? req.method : 'N/A',
        createdAt: new Date().toISOString()
      };

      // Simpan ke collection 'error_logs' di Firebase (otomatis kena prefix sbx_ kalau dev)
      await firestoreService.add('logger', errorData);
      console.log('📝 [Error Log Saved to Firebase]:', err.message);
    } catch (dbError) {
      console.error('❌ Gagal menyimpan error log ke database:', dbError.message);
    }
  }
}

module.exports = ErrorLogger;

// config/api_error.js

class ApiError extends Error {
  constructor(statusCode, publicMessage, rawError = null) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.rawError = rawError; // Menyimpan error asli dari provider/system untuk database

    Error.captureStackTrace(this, this.constructor);
  }

  // Parsing error dari provider SMS
  static provider(responseStr) {
    if (!responseStr || typeof responseStr !== 'string') {
      return new ApiError(500, 'Terjadi gangguan pada server provider.', 'Invalid provider response');
    }

    const res = responseStr.trim();
    if (res.startsWith('ACCESS_') || res.startsWith('STATUS_')) return null;

    // Petakan error provider ke bahasa ramah user, tapi simpan error aslinya (res)
    switch (res) {
      case 'BAD_KEY':
        return new ApiError(401, 'Autentikasi sistem gagal. Hubungi admin.', res);
      case 'NO_NUMBERS':
        return new ApiError(404, 'Stok nomor untuk layanan tersebut sedang kosong.', res);
      case 'NO_BALANCE':
        return new ApiError(400, 'Provider sedang gangguan. Harap lapor admin.', res);
      case 'BAD_ACTION':
        return new ApiError(400, 'Perintah sistem tidak valid.', res);
      case 'BAD_SERVICE':
        return new ApiError(400, 'Layanan tidak ditemukan.', res);
      default:
        return new ApiError(400, 'Gagal memproses permintaan ke provider.', res);
    }
  }

  static badRequest(message, raw = null) {
    return new ApiError(400, message, raw);
  }

  static internal(message = 'Terjadi kesalahan pada server internal.', raw = null) {
    return new ApiError(500, message, raw);
  }
}

module.exports = ApiError;

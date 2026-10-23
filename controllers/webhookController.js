// controller/authController.js
const ApiConfig = require('../config/api_config');
const { handleTelegramUpdate } = require('../services/telegram_bot');
const midtransClient = require('midtrans-client');
const crypto = require('crypto'); // Built-in Node.js module untuk hashing
const firestoreService = require('../config/logic_firebase');
const ApiError = require('../config/api_error');   

// Inisialisasi CoreApi Midtrans untuk verifikasi notifikasi webhook
const coreApi = new midtransClient.CoreApi({
    isProduction: ApiConfig.MIDTRANS.IS_PRODUCTION === 'production', // Sesuaikan dengan environment Anda (true/false)
    serverKey: ApiConfig.MIDTRANS.SERVER_KEY,
    clientKey: ApiConfig.MIDTRANS.CLIENT_KEY
});

// Endpoint yang akan "ditembak" oleh Telegram setiap ada pesan/update masuk
exports.telegramWebhook = async (req, res, next) => {
    try {
        const update = req.body;
        // Ambil URL dasar secara dinamis dari request (untuk mode production)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const productionUrl = `${protocol}://${host}`;

        // Teruskan update ke service/telegram-bot.js
        await handleTelegramUpdate(update, productionUrl);

        // Wajib kirim status 200 OK ke Telegram agar tidak dikira error/timeout
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error pada telegramWebhook:', error);
        next(error);
    }
};

// MIDTRANS
exports.midtransWebhook = async (req, res) => {
  try {
    const notificationJson = req.body || {};
    const {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmountStr,
      signature_key: receivedSignatureKey,
    } = notificationJson;

    // 1. Validasi payload wajib
    if (!orderId || !statusCode || !grossAmountStr || !receivedSignatureKey) {
      console.warn("⚠️ Payload webhook tidak lengkap:", notificationJson);
      return res.status(200).json({ status: 'ignored', message: 'Incomplete payload' });
    }

    const grossAmount = Number(grossAmountStr);
    if (!Number.isFinite(grossAmount)) {
      console.warn("⚠️ gross_amount tidak valid:", grossAmountStr);
      return res.status(200).json({ status: 'ignored', message: 'Invalid gross_amount' });
    }

    // 2. Verifikasi Signature Key
    const serverKey = ApiConfig.MIDTRANS.SERVER_KEY;
    const rawData = orderId + statusCode + grossAmountStr + serverKey;
    const calculatedSignatureKey = crypto
      .createHash('sha512')
      .update(rawData)
      .digest('hex');

    if (calculatedSignatureKey !== receivedSignatureKey) {
      console.warn("⚠️ Invalid signature key:", orderId);
      return res.status(200).json({ status: 'ignored', message: 'Invalid signature key' });
    }

    // 3. Ambil status resmi dari Midtrans (jangan hanya percaya payload)
    const statusResponse = await coreApi.transaction.notification(notificationJson);
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    //console.log(`ℹ️ Midtrans status: ${transactionStatus}, fraud: ${fraudStatus}, order: ${orderId}`);

    // 4. Ambil transaksi dari Firestore
    const trx = await firestoreService.getByField('transactions', 'order_id', orderId);
    if (!trx) {
      console.warn(`⚠️ Transaksi ${orderId} tidak ditemukan di Firestore.`);
      // Tetap balas 200 supaya Midtrans tidak retry terus
      return res.status(200).json({ status: 'ignored', message: 'Transaction not found' });
    }

    // 5. 🔥 Guard anti double-credit
    // Kalau transaksi sudah pernah diproses sebagai success, jangan tambah saldo lagi.
    if (trx.status === 'success') {
      console.log(`ℹ️ Transaksi ${orderId} sudah berstatus success, skip.`);
      return res.status(200).json({ status: 'OK', message: 'Already processed' });
    }

    // 6. Tentukan status final
    let finalStatus = 'pending';
    let shouldCredit = false;

    if (transactionStatus === 'settlement') {
      finalStatus = 'success';
      shouldCredit = true;
    } else if (transactionStatus === 'capture') {
      // Kartu kredit: hanya sukses kalau fraud accept
      if (fraudStatus === 'accept') {
        finalStatus = 'success';
        shouldCredit = true;
      } else {
        finalStatus = 'challenge'; // butuh review
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
      finalStatus = 'cancel';
    } else if (transactionStatus === 'expire') {
      finalStatus = 'expired';
    } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
      finalStatus = 'refund';
    } else if (transactionStatus === 'pending') {
      finalStatus = 'pending';
    }

    // 7. Update status transaksi
    await firestoreService.set(
      "transactions",
      trx.documentId,
      { status: finalStatus, updated_at: new Date() },
      { merge: true }
    );

    // 8. Tambah saldo kalau memang sudah dibayar
    if (shouldCredit) {
      // Prioritas: pakai uid dari dokumen transaksi (lebih akurat)
      let uid = trx.user.uid;

      // Fallback: parse dari orderId (format harus jelas, mis. TRX-<uid>-<timestamp>)
      if (!uid) {
        const parts = String(orderId).split('-');
        uid = parts.length >= 2 ? parts[parts.length - 2] : parts.pop();
        console.warn(`⚠️ uid tidak ada di dokumen transaksi, fallback parse: ${uid}`);
      }

      const foundUser = await firestoreService.getByField("users", "telegram.uid", String(uid));

      if (!foundUser) {
        console.warn(`⚠️ User telegram.uid ${uid} tidak ditemukan!`);
        return res.status(200).json({ status: 'OK', message: 'User not found' });
      }

      // Pakai nominal dari Midtrans (lebih aman dari manipulasi payload)
      const amountToCredit = Number(statusResponse.gross_amount) || grossAmount;
      const currentBalance = Number(foundUser.balance || 0);
      const newBalance = currentBalance + amountToCredit;
      //console.log("data : ", foundUser)
      // Catat juga supaya bisa diaudit
      await firestoreService.set(
        "users",
        foundUser.uid,
        {
          balance: newBalance,
          last_topup_at: new Date(),
          last_topup_amount: amountToCredit,
        },
        { merge: true }
      );

      //console.log(`✅ SETTLEMENT! Saldo user ${uid} +${amountToCredit}. Total: ${newBalance}`);
    } else {
      console.log(`ℹ️ Status ${transactionStatus} → saldo tidak ditambah.`);
    }

    return res.status(200).json({ status: 'OK', message: 'Webhook handled' });

  } catch (err) {
    console.error('❌ Error webhook:', err);
    // Tetap 200 agar Midtrans tidak retry bertubi-tubi.
    // Kalau mau retry, ubah jadi 500 — tapi pastikan idempotent.
    return res.status(200).json({ status: 'error_handled', message: err.message });
  }
};
const axios = require('axios');
const apiConfig = require('../config/api_config');
const ApiError = require('../config/api_error');

class MidtransService {
  constructor() {
    // Tentukan URL API Midtrans (Sandbox vs Production)
    const isProd = apiConfig.MIDTRANS.IS_PRODUCTION;
    this.baseUrl = isProd 
      ? 'https://api.midtrans.com/v2' 
      : 'https://api.sandbox.midtrans.com/v2';
      
    // Midtrans butuh Basic Auth (Server Key yang di-encode ke Base64)
    const encodedKey = Buffer.from(apiConfig.MIDTRANS.SERVER_KEY + ':').toString('base64');
    this.headers = {
      'Authorization': `Basic ${encodedKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // Fungsi untuk Membuat QRIS Top Up
  async createQrisCharge(orderId, amount, customerPhone) {
    try {
      const payload = {
        payment_type: 'qris',
        transaction_details: {
          order_id: orderId,
          gross_amount: amount // Contoh: 50000
        },
        qris: {
          acquirer: 'gopair' // atau airpay / shopeepay tergantung preferensi
        },
        customer_details: {
          phone: customerPhone || '00000000'
        }
      };

      const response = await axios.post(`${this.baseUrl}/charge`, payload, { headers: this.headers });
      
      // Ambil URL gambar QRIS dari respon Midtrans
      const qrisUrl = response.data.actions?.find(action => action.name === 'generate-qr-code')?.url;

      return {
        orderId: response.data.order_id,
        qrisUrl: qrisUrl,
        raw: response.data
      };
    } catch (error) {
      const errorMsg = error.response?.data?.status_message || error.message;
      throw ApiError.badRequest(`Gagal membuat QRIS pembayaran: ${errorMsg}`, errorMsg);
    }
  }
}

module.exports = new MidtransService();

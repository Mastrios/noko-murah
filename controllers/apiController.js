const firestoreService = require("../config/logic_firebase");
const ApiError = require("../config/api_error");
const ApiConfig = require("../config/api_config");
const midtransClient = require('midtrans-client');
const crypto = require('crypto');
const heroSmsService = require('../services/server_nokos'); // Cukup pakai service saja

// Inisialisasi CoreApi Midtrans
const coreApi = new midtransClient.CoreApi({
    isProduction: ApiConfig.MIDTRANS.IS_PRODUCTION === 'production',
    serverKey: ApiConfig.MIDTRANS.SERVER_KEY,
    clientKey: ApiConfig.MIDTRANS.CLIENT_KEY
});

class ApiController {
  async index(req, res, next){
    res.json({
      success : true
    });
  }

  // 1. Membuat QRIS Custom (Core API) dengan Custom Notification URL & Fetch URL QR ke Base64
  async createdQris(req, res, next){
    try {
      const { uid, grossAmount, customerDetails } = req.body;
      const server = await firestoreService.get("settings", "I4b8Whpc4KGWzNpiE5NM");
      if (!grossAmount) {
        throw ApiError.badRequest("Gross Amount wajib diisi!");
      }
      const totalGross = Number(server.server.midtrans.qris) + grossAmount;

      // Generate orderId otomatis: NK- + 10 karakter acak (huruf besar & angka) + uid
      const randomString = crypto.randomBytes(5).toString('hex').toUpperCase();
      const orderId = `NK-${randomString}-${uid}`;

      // Parameter request charge khusus QRIS
      const parameter = {
        payment_type: 'qris',
        transaction_details: {
          order_id: orderId,
          gross_amount: Number(totalGross)
        },
        qris: {
          acquirer: "gopay"
        }
      };

      const webhookUrl = `${ApiConfig.SETTINGS.DOMAIN}/webhook/midtrans`;
      
      // Request charge ke Midtrans Core API
      const chargeResponse = await coreApi.charge(parameter, {
        headers: {
          'X-Override-Notification': webhookUrl
        }
      });

      // Ambil string mentah QRIS (EMVCo string) dan URL gambar QR dari Midtrans
      const qrString = chargeResponse.qr_string || chargeResponse.actions?.[0]?.url; 
      const rawImageUrl = chargeResponse.actions?.find(action => action.name === 'generate-qr-code')?.url || '';
      
      // Ubah URL gambar QR dari Midtrans langsung menjadi Base64
      let qrBase64 = rawImageUrl;
      if (rawImageUrl) {
        try {
          const imageResponse = await fetch(rawImageUrl);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            qrBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
          }
        } catch (fetchErr) {
          console.error('Gagal mengambil/mengonversi URL gambar QR ke Base64:', fetchErr);
        }
      }

      // SIMPAN KE FIRESTORE
      await firestoreService.set("transactions", orderId, {
        order_id: orderId,
        user: {
          uid: uid
        },
        gross_amount: Number(grossAmount),
        status: "pending",
        payment_type: "qris",
        qr_string: qrString,
        created_at: new Date()
      }, { merge: true });

      const isSandboxMode = ApiConfig.MIDTRANS.IS_PRODUCTION === 'sandbox';

      return res.status(200).json({
        status: "success",
        message: "QRIS custom berhasil dibuat",
        isSandbox: isSandboxMode, 
        data: {
          order_id: orderId,
          gross_amount: grossAmount,
          qr_string: qrBase64,        
          qr_image_url: rawImageUrl      
        }
      });

    } catch(err) {
      next(err);
    }
  }

  // 2. Polling Status Langsung ke Midtrans
  async pollingStatus(req, res, next){
    try {
      const { orderId } = req.params;

      if (!orderId) {
        throw ApiError.badRequest("Order ID wajib disertakan dalam parameter URL!");
      }

      const statusResponse = await coreApi.transaction.status(orderId);
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      let mappedStatus = "pending";

      if (transactionStatus === 'capture') {
          if (fraudStatus === 'accept') mappedStatus = "success";
      } else if (transactionStatus === 'settlement') {
          mappedStatus = "success";
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
          mappedStatus = "cancel";
      } else if (transactionStatus === 'expire') {
          mappedStatus = "expired";
      }

      return res.status(200).json({
        status: "success",
        data: {
          order_id: orderId,
          transaction_status: transactionStatus,
          mapped_status: mappedStatus,
          gross_amount: statusResponse.gross_amount,
          payment_type: statusResponse.payment_type
        }
      });

    } catch(err) {
      next(err);
    }
  }

  // 3. Cancel Order 
  async cancelOrder(req, res, next){
    try {
      const { orderId } = req.body;

      if (!orderId) {
        throw ApiError.badRequest("Order ID wajib diisi!");
      }

      try {
        await coreApi.transaction.cancel(orderId);
      } catch (midtransErr) {
        console.warn(`Gagal membatalkan transaksi di Midtrans untuk ${orderId}:`, midtransErr.message);
      }

      const dbRecord = await firestoreService.getByField('transactions', 'order_id', orderId);

      if (dbRecord) {
        await firestoreService.set("transactions", dbRecord.documentId, {
          status: "cancel"
        }, { merge: true });
      }

      return res.status(200).json({
        status: "success",
        message: "Transaksi berhasil dibatalkan",
        data: {
          order_id: orderId,
          transaction_status: "cancel"
        }
      });

    } catch(err) {
      next(err);
    }
  }
  
  // ============================================================
  // API HERO SMS (DIPERBAIKI)
  // ============================================================

  /**
   * Mendapatkan daftar negara
   */
  async getCountries(req, res, next) {
    try {
      // Memanggil method getCountries dari service heroSmsService
      const countriesData = await heroSmsService.getCountries();

      return res.status(200).json({
        success: true,
        data: countriesData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mendapatkan daftar layanan/service
   */
  async getServices(req, res, next) {
    try {
      const { country } = req.query;

      // Ambil daftar layanan dari service
      const servicesData = await heroSmsService.getServicesList(country || '');
       
      return res.status(200).json({
        success: true,
        data: servicesData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mendapatkan daftar operator berdasarkan negara
   */
  async getOperators(req, res, next) {
    try {
      const { country } = req.query;

     /** if (!country) {
        throw ApiError.badRequest("Parameter country wajib diisi.");
      }**/

      const operatorData = await heroSmsService.getOperators(country);

      return res.status(200).json({
        success: true,
        data: operatorData.countryOperators
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
  * Mendapatkan Biaya
  */
  async getPrices(req, res, next){
    try{
      const { service, country } = req.query
      const priceData = await heroSmsService.getPrices(service, country);
      
      return res.status(200).json({
        success: true,
        data: priceData
      });
    }catch(err){
      next(err)
    }
  }
  
  /**
  * Buy Number
  */
  async buyNumber(req, res, next){
    try{
      const { service, country, operator = '', version } = req.body
      let response;
      
      if(version == "v1"){
        response = await heroSmsService.getNumber1(service, country, operator)
      }else if(version == "v2"){
        response = await heroSmsService.getNumber2(service, country, operator)
      }
      console.log(req.body)
      console.log(response)
      return res.status(200).json({
        success: true,
        data: response
      });
    }catch(err){
      next(err)
    }
  }
}

module.exports = new ApiController();

require('dotenv').config();

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  // Port Server
  PORT: process.env.PORT,

  // Konfigurasi API Provider (HeroSMS atau penyedia nokos lainnya)
  // Bisa otomatis ganti URL jika diperlukan, atau pakai satu URL utama
  PROVIDER: {
    BASE_URL: process.env.PROVIDER_BASE_URL,
    API_KEY: process.env.PROVIDER_API_KEY
  },
  
  // Konfigurasi GOOGLE
  GOOGLE:{
    CLIENT_ID : process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
  },
  // Konfigurasi Telegram Bot
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || ''
  },
  
  // Konfigurasi Midtrans Payment
  MIDTRANS: {
    CLIENT_KEY: process.env.MIDTRANS_CLIENT,
    SERVER_KEY: process.env.MIDTRANS_SERVER,
    IS_PRODUCTION: isProduction ? "production" : "sandbox"
  },
  // Status Environment saat ini (sinkron dengan logic_firebase.js)
  ENV: isProduction ? "production" : "sandbox",
  
  //document
  DOCUMENT: isProduction? "" : "sbx_",
  // Parameter tambahan lain jika nanti dibutuhkan (misal markup harga / kurs)
  SETTINGS: {
    DOMAIN:process.env.DOMAIN,
    DEFAULT_MARKUP_PERCENTAGE: process.env.DEFAULT_MARKUP_PERCENTAGE // Contoh markup harga jual ke user (20%)
  }
};

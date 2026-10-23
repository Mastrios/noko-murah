// services/server_nokos.js
const { HeroSMSClient } = require('hero-sms');
const ApiConfig = require('../config/api_config');
const ApiError = require('../config/api_error');

const client = new HeroSMSClient({
  apiKey: ApiConfig.PROVIDER.API_KEY
});

class HeroSmsService {
  async getBalance() {
    try { return await client.getBalance(); } 
    catch (error) {  throw ApiError.provider(error.message || 'Gagal mengambil saldo.'); }
  }

  async getNumber1(service, country, operator = '') {
    try { return await client.getNumber({ service, country, operator }); } 
    catch (error) { console.log(error); throw ApiError.provider(error.message || 'Gagal mendapatkan nomor.'); }
  }
  async getNumber2(service, country, operator = '') {
    try { return await client.getNumberV2({ service, country, operator }); } 
    catch (error) { console.log(error); throw ApiError.provider(error.message || 'Gagal mendapatkan nomor.'); }
  }

  async getStatus(id) {
    try { return await client.getStatus({ id }); } 
    catch (error) { throw ApiError.provider(error.message || 'Gagal mengecek status.'); }
  }

  async setStatus(id, status) {
    try { return await client.setStatus({ id, status }); } 
    catch (error) { throw ApiError.provider(error.message || 'Gagal mengubah status.'); }
  }

  async getCountries() {
    try {
      const res = await client.getCountries();
      // Mengembalikan objek/array data negara secara utuh
      return res.data || res.countries || res;
    } catch (error) {
      throw ApiError.internal('Gagal mengambil daftar negara.', error.message);
    }
  }

  async getServicesList(country = '') {
    try {
      const res = await client.getServicesList({ country });
      // Mengembalikan objek/array data layanan secara utuh
      return res.data || res.services || res;
    } catch (error) {
      throw ApiError.internal('Gagal mengambil daftar layanan.', error.message);
    }
  }

  async getOperators(country) {
    try {
      const res = await client.getOperators({ country });
      return res.data || res.operators || res;
    } catch (error) {
      throw ApiError.internal('Gagal mengambil daftar operator.', error.message);
    }
  }

  /**
   * Mengambil informasi harga layanan/nomor dari provider
   * @param {string} [service] - Kode layanan opsional (misal: 'wa', 'tg', dll)
   * @param {string} [country] - ID negara opsional (misal: '1', '6', dll)
   */
  async getPrices(service = '', country = '') {
    try {
      // Menyesuaikan parameter dengan method dari client library 'hero-sms'
      const params = {};
      if (service) params.service = service;
      if (country) params.country = country;

      const res = await client.getPrices(params);
      return res.data || res.prices || res;
    } catch (error) {
      throw ApiError.internal('Gagal mengambil daftar harga.', error.message);
    }
  }
}

module.exports = new HeroSmsService();

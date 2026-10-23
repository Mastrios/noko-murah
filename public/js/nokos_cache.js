/**
 * Helper Nokos Cache & Loader Manager (Updated with 24-Hour Prices Cache)
 */
const NokosCache = {
    // 1. Buat elemen HTML Popup Loader secara dinamis ke dalam body
    injectLoaderModal() {
        if (document.getElementById('nokosLoaderOverlay')) return;

        const loaderHtml = `
            <div id="nokosLoaderOverlay" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
                display: none; justify-content: center; align-items: center;
                z-index: 99999; opacity: 0; transition: opacity 0.3s ease;
            ">
                <div style="
                    background: var(--bg-card, #1e293b); color: var(--text-main, #f8fafc);
                    padding: 24px 28px; border-radius: 20px; max-width: 320px; width: 90%;
                    text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                    border: 1px solid var(--border-color, #334155);
                    display: flex; flex-direction: column; align-items: center; gap: 16px;
                ">
                    <!-- Ikon / Animasi Download Data -->
                    <div id="loaderIconContainer" style="
                        width: 50px; height: 50px; background: rgba(37, 99, 235, 0.15);
                        border-radius: 50%; display: flex; justify-content: center; align-items: center;
                        color: #2563eb; animation: pulseDownload 1.5s ease-in-out infinite;
                    ">
                        <!-- SVG Ikon Download -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                    
                    <div>
                        <h4 id="loaderTitle" style="font-size: 1rem; font-weight: 700; margin-bottom: 6px;">Menyiapkan Provider</h4>
                        <p id="loaderMessage" style="font-size: 0.82rem; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                            Menyiapkan data provider terbaru. Mohon tunggu sebentar, dan pastikan Anda terhubung ke internet.
                        </p>
                    </div>

                    <!-- Tombol Coba Lagi (Muncul jika ada error) -->
                    <button id="loaderRetryBtn" onclick="location.reload()" style="
                        display: none; background: #2563eb; color: white; border: none;
                        padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
                    ">Coba Lagi</button>
                </div>
            </div>
            <style>
                @keyframes pulseDownload {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.8; }
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', loaderHtml);
    },

    showLoader(message = "Menyiapkan data provider terbaru. Mohon tunggu sebentar, dan pastikan Anda terhubung ke internet.") {
        this.injectLoaderModal();
        const overlay = document.getElementById('nokosLoaderOverlay');
        const iconContainer = document.getElementById('loaderIconContainer');
        const titleEl = document.getElementById('loaderTitle');
        const msgEl = document.getElementById('loaderMessage');
        const retryBtn = document.getElementById('loaderRetryBtn');

        if (titleEl) titleEl.textContent = "Menyiapkan Provider";
        if (iconContainer) iconContainer.style.display = 'flex';
        if (msgEl) msgEl.textContent = message;
        if (retryBtn) retryBtn.style.display = 'none';
        
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }
    },

    hideLoader() {
        const overlay = document.getElementById('nokosLoaderOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    },

    showError(errorMessage) {
        const iconContainer = document.getElementById('loaderIconContainer');
        const titleEl = document.getElementById('loaderTitle');
        const msgEl = document.getElementById('loaderMessage');
        const retryBtn = document.getElementById('loaderRetryBtn');

        if (iconContainer) iconContainer.style.display = 'none';
        if (titleEl) titleEl.textContent = "Gagal Memuat Data";
        if (msgEl) msgEl.textContent = errorMessage;
        if (retryBtn) retryBtn.style.display = 'inline-block';
    },

    // 2. Cek apakah cache prices masih berlaku (< 24 jam)
    isPricesCacheValid() {
        const cachedTime = localStorage.getItem('nokos_prices_time');
        if (!cachedTime) return false;

        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
        const now = new Date().getTime();

        // Return true jika umur cache belum 24 jam
        return (now - parseInt(cachedTime, 10)) < twentyFourHours;
    },

    // 3. Fungsi Utama: Cek LocalStorage atau Fetch Backend secara Paralel (Termasuk Prices)
    async loadProviderData(forceRefreshPrices = false) {
        const localServices = localStorage.getItem('nokos_services');
        const localCountries = localStorage.getItem('nokos_countries');
        const localOperators = localStorage.getItem('nokos_operators');
        const localPrices = localStorage.getItem('nokos_prices');

        const pricesValid = this.isPricesCacheValid() && !forceRefreshPrices;

        // Jika semua data dasar DAN prices masih valid, langsung kembalikan dari localStorage
        if (localServices && localCountries && localOperators && localPrices && pricesValid) {
            return {
                services: JSON.parse(localServices),
                countries: JSON.parse(localCountries),
                operators: JSON.parse(localOperators),
                prices: JSON.parse(localPrices)
            };
        }

        // Tampilkan loader jika data prices kedaluwarsa atau belum lengkap
        this.showLoader(pricesValid ? "Menyiapkan data provider..." : "Memperbarui data harga terbaru (24 Jam)...");

        try {
            const [resServices, resCountries, resOperators, resPrices] = await Promise.all([
                fetch('/api/v1/getServices'),
                fetch('/api/v1/getCountries'),
                fetch('/api/v1/getOperators'),
                fetch('/api/v1/getPrices')
            ]);

            const dataServices = await resServices.json();
            const dataCountries = await resCountries.json();
            const dataOperators = await resOperators.json();
            const dataPrices = await resPrices.json();

            let hasError = false;
            let errorMessage = "";

            if (resServices.ok && (dataServices.success || dataServices.status === 'success')) {
                localStorage.setItem('nokos_services', JSON.stringify(dataServices.data || dataServices));
            } else {
                hasError = true;
                errorMessage = "Gagal memuat data layanan (service) dari provider.";
            }

            if (resCountries.ok && (dataCountries.success || dataCountries.status === 'success')) {
                localStorage.setItem('nokos_countries', JSON.stringify(dataCountries.data || dataCountries));
            } else {
                hasError = true;
                errorMessage = errorMessage || "Gagal memuat data negara dari provider.";
            }
            
            if (resOperators.ok && (dataOperators.success || dataOperators.status === 'success')) {
                localStorage.setItem('nokos_operators', JSON.stringify(dataOperators.data || dataOperators));
            } else {
                hasError = true;
                errorMessage = errorMessage || "Gagal memuat data operator dari provider.";
            }

            if (resPrices.ok && (dataPrices.success || dataPrices.status === 'success')) {
                localStorage.setItem('nokos_prices', JSON.stringify(dataPrices.data || dataPrices));
                localStorage.setItem('nokos_prices_time', new Date().getTime().toString()); // Set timestamp baru
            } else {
                hasError = true;
                errorMessage = errorMessage || "Gagal memuat data harga (prices) dari provider.";
            }

            if (hasError) {
                this.showError(`${errorMessage} Pastikan koneksi internet stabil.`);
                throw new Error(errorMessage);
            }

            this.hideLoader();

            return {
                services: JSON.parse(localStorage.getItem('nokos_services')),
                countries: JSON.parse(localStorage.getItem('nokos_countries')),
                operators: JSON.parse(localStorage.getItem('nokos_operators')),
                prices: JSON.parse(localStorage.getItem('nokos_prices'))
            };

        } catch (error) {
            console.error('Error saat mengambil data provider:', error);
            this.showError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
            throw error;
        }
    },

    // 4. Fungsi Refresh Manual dengan Fake Progress Teks Dinamis
    async refreshProviderData() {
        // Hapus semua cache termasuk waktu prices agar memaksa fetch ulang
        localStorage.removeItem('nokos_services');
        localStorage.removeItem('nokos_countries');
        localStorage.removeItem('nokos_operators');
        localStorage.removeItem('nokos_prices');
        localStorage.removeItem('nokos_prices_time');

        this.showLoader("Menghubungkan ke server penyedia...");

        const progressSteps = [
            { text: "Menghubungkan ke penyedia provider...", delay: 500 },
            { text: "Mengunduh database layanan & harga terbaru...", delay: 700 },
            { text: "Sinkronisasi data negara & operator...", delay: 600 },
            { text: "Menyimpan cache lokal sistem...", delay: 400 }
        ];

        const msgEl = document.getElementById('loaderMessage');

        for (const step of progressSteps) {
            if (msgEl) msgEl.textContent = step.text;
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }

        try {
            const data = await this.loadProviderData(true);
            return {
                success: true,
                message: "Data provider & harga berhasil diperbarui!",
                data: data
            };
        } catch (error) {
            return {
                success: false,
                message: "Gagal memperbarui data provider."
            };
        }
    }
};

// 5. Fungsi Inisialisasi Global
async function initService() {
    let cached = localStorage.getItem('nokos_services');
    if (cached) return JSON.parse(cached);
    
    const data = await NokosCache.loadProviderData();
    return data.services;
}

async function initCountry() {
    let cached = localStorage.getItem('nokos_countries');
    if (cached) return JSON.parse(cached);
    
    const data = await NokosCache.loadProviderData();
    return data.countries;
}

// 6. Fungsi untuk mengambil data operator sesuai ID negara dari localStorage
async function getOperator(countryId) {
    let cached = localStorage.getItem('nokos_operators');
    
    let operatorsData = cached ? JSON.parse(cached) : null;
    if (!operatorsData) {
        const loaded = await NokosCache.loadProviderData();
        operatorsData = loaded.operators;
    }

    if (!operatorsData) return [];

    const countryOperators = operatorsData[countryId] || (operatorsData.result && operatorsData.result[countryId]) || [];
    return countryOperators;
}

// 7. Fungsi Global Baru: Mengambil data Prices (Otomatis cek kedaluwarsa 24 jam)
async function getPrices() {
    // Jika cache prices masih valid dan ada, langsung ambil dari localStorage tanpa popup
    if (NokosCache.isPricesCacheValid()) {
        const cachedPrices = localStorage.getItem('nokos_prices');
        if (cachedPrices) {
            return JSON.parse(cachedPrices);
        }
    }
    
    // Jika sudah > 24 jam atau belum ada, loadProviderData akan otomatis menampilkan popup loader & fetch data baru
    const data = await NokosCache.loadProviderData();
    return data.prices;
}

// ==========================================
// 8. FUNGSI KONVERSI DOLLAR KE RUPIAH (LIVE RATE + PROFIT 50%)
// ==========================================

const CurrencyConverter = {
    async getLatestRate() {
        const cachedRate = localStorage.getItem('nokos_usd_to_idr');
        const cachedTime = localStorage.getItem('nokos_rate_time');
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (cachedRate && cachedTime && (now - parseInt(cachedTime, 10)) < twentyFourHours) {
            return parseFloat(cachedRate);
        }

        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            
            if (data && data.rates && data.rates.IDR) {
                const liveRate = data.rates.IDR;
                localStorage.setItem('nokos_usd_to_idr', liveRate);
                localStorage.setItem('nokos_rate_time', now.toString());
                return liveRate;
            }
        } catch (err) {
            console.error("Gagal mengambil kurs USD terbaru, menggunakan kurs fallback:", err);
        }

        return cachedRate ? parseFloat(cachedRate) : 16000;
    }
};

// Fungsi Utama cv(priceInUSD) dengan Margin Profit 50% (Dikalikan 1.5)
async function cv(priceInUSD) {
    const num = parseFloat(priceInUSD);
    if (isNaN(num) || num <= 0) return "Rp 0";
    
    const rate = await CurrencyConverter.getLatestRate();
    
    // Tambah keuntungan 50% (Harga Asli USD * 1.5)
    const priceWithProfitUSD = num * 1.5;
    const priceInIDR = Math.round(priceWithProfitUSD * rate);

    return `Rp ${priceInIDR.toLocaleString('id-ID')}`;
}

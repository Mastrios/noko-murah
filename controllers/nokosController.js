// controllers/nokosControllers.js
const fetch = require("node-fetch");
const { PROVIDER_ACTIONS, buildApiUrl } = require("../config/api_params");
const firestoreService = require("../config/logic_firebase");
const ApiConfig = require("../config/api_config");
const ApiError = require("../config/api_error");
const { BASE_URL, API_KEY } = ApiConfig.PROVIDER;

class NokosController {
    // Get Countries
    async countries(req, res, next) {
        try {
            const url = buildApiUrl(
                BASE_URL,
                API_KEY,
                PROVIDER_ACTIONS.GET_COUNTRIES
            );
            const response = await fetch(url);
            const result = await response.text();
            return res.status(200).json({
                success: true,
                result: JSON.parse(result)
            });
        } catch (err) {
            next(err);
        }
    }
    // Get Services
    async services(req, res, next) {
        try {
            const { country } = req.query;

            const url = buildApiUrl(
                BASE_URL,
                API_KEY,
                PROVIDER_ACTIONS.GET_SERVICES_LIST,
                {
                    lang: "id",
                    country: country
                }
            );

            const response = await fetch(url);
            const rawText = await response.text();

            let data;
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                return res.status(502).json({
                    success: false,
                    message: "Gagal memparsing respons dari provider eksternal",
                    error: rawText
                });
            }

            // Mengambil array services dan status dari hasil parse API eksternal
            return res.status(200).json({
                success: true,
                status: data.status || "success",
                services: Array.isArray(data.services) ? data.services : []
            });
        } catch (err) {
            next(err);
        }
    }

    // Get Operator
    async operators(req, res, next) {
        try {
            const { country } = req.query;
            const url = buildApiUrl(
                BASE_URL,
                API_KEY,
                PROVIDER_ACTIONS.GET_OPERATORS,
                {
                    country: country
                }
            );
            const response = await fetch(url);
            const result = await response.text();
            return res.status(200).json({
                success: true,
                result: JSON.parse(result)
            });
        } catch (err) {
            next(err);
        }
    }
    // Get Prices
    async prices(req = {}, res = null, next = null) {
        try {
            const { country, service } = req.query || {};

            const url = buildApiUrl(
                BASE_URL,
                API_KEY,
                PROVIDER_ACTIONS.GET_PRICES,
                {
                    country: country,
                    service: service
                }
            );

            const response = await fetch(url);
            const rawText = await response.text();

            let data;
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                const errorPayload = {
                    success: false,
                    message: "Gagal memparsing respons harga dari provider eksternal",
                    error: rawText
                };
                if (res && typeof res.status === 'function') {
                    return res.status(502).json(errorPayload);
                }
                return { success: false, prices: {} };
            }

            const formattedResult = {
                success: true,
                status: data.status || "success",
                prices: data.prices || data.data || data
            };

            // Jika dipanggil lewat Express Route API
            if (res && typeof res.status === 'function') {
                return res.status(200).json(formattedResult);
            }

            // Jika dipanggil secara internal dari controller lain
            return formattedResult;

        } catch (err) {
            if (next && typeof next === 'function') {
                return next(err);
            }
            if (res && typeof res.status === 'function') {
                return res.status(500).json({ success: false, message: err.message });
            }
            throw err;
        }
    }

}

module.exports = new NokosController();

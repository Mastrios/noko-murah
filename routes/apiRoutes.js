// routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const Api = require('../controllers/apiController');
const nokos = require('../controllers/nokosController');

// TEST API 
router.get("/", (req, res, next) => Api.index(req, res, next))
// MIDTRANS
router.post('/mds/created-qris-front', (req, res, next) => Api.createdQris(req, res, next));
router.get('/mds/polling/:orderId', (req, res, next) => Api.pollingStatus(req, res, next));
router.post('/mds/cancel', (req, res, next) => Api.cancelOrder(req, res, next));

// HERO SMS
router.post('/buy', (req, res, next) => Api.buyNumber(req, res, next));
router.get('/v1/getCountries', (req, res, next) => Api.getCountries(req, res, next));
router.get('/v1/getServices', (req, res, next) => Api.getServices(req, res, next));
router.get('/v1/getOperators', (req, res, next) => Api.getOperators(req, res, next));
router.get('/v1/getPrices', (req, res, next) => Api.getPrices(req, res, next));

module.exports = router;

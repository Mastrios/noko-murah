const firestoreService = require("../config/logic_firebase");
const ApiError = require("../config/api_error");
const ApiConfig = require("../config/api_config");
const heroSms = require("../services/server_nokos"); // Service hero-sms v2.0.0 kita

class IndexController {
    async indexHome(req, res, next) {
        try {
            res.send(
                `<h1>Panel Nokos Berjalan!</h1><p>Saldo Provider: <b>Rp 50.000.000,-</b></p>`
            );
        } catch (error) {
            next(error);
        }
    }

    async privacy(req, res, next) {
        try {
            res.send(
                `<h1>Panel Nokos Berjalan!</h1><p>Saldo Provider: <b>Rp 50.000.000,-</b></p>`
            );
        } catch (error) {
            next(error);
        }
    }

    async term(req, res, next) {
        try {
            res.send(
                `<h1>Panel Nokos Berjalan!</h1><p>Saldo Provider: <b>Rp 50.000.000,-</b></p>`
            );
        } catch (error) {
            next(error);
        }
    }

    async notif(req, res, next) {
        try {
        } catch (e) {
            next(e);
        }
    }
    
    // ==========================================
        // ADMIN DASHBOARD
    // ==========================================
    async adminLogger(req, res, next){
      try{
        const logger = await firestoreService.getAll("logger");
        return res.render("telegram/admin/logger", {
          logger : logger
        })
      }catch(err){
        next(err)
      }
    }
    // ==========================================
    // TELEGRAM DASHBOARD (Diperbarui)
    // ==========================================
        async telegramDash(req, res, next) {
        try {
            if (!req.user || req.user === "undefined") {
                const telegram_ID = req.params.telegramId;
                if (telegram_ID) {
                    const foundUser = await firestoreService.getByField(
                        "users",
                        "telegram.uid",
                        String(telegram_ID)
                    );
                    if (foundUser) {
                        req.user = foundUser;
                    }
                }
            }

            

            return res.status(200).render("telegram/order", { 
                user: req.user || null
            });
            
        } catch (err) {
            next(err);
        }
    }

    async telegramTopUp(req, res, next) {
        try {
            let riwayat = [];

            if (!req.user || req.user === "undefined") {
                const telegram_ID = req.params.telegramId;

                if (telegram_ID) {
                    const foundUser = await firestoreService.getByField(
                        "users",
                        "telegram.uid",
                        String(telegram_ID)
                    );

                    if (foundUser) {
                        req.user = foundUser;
                    }

                    const fetchedRiwayat = await firestoreService.query(
                        `transactions`,
                        [
                            {
                                field: "user.uid",
                                operator: "==",
                                value: String(telegram_ID)
                            }
                        ],
                        {
                            orderBy: "createdAt",
                            orderDirection: "desc"
                        }
                    );

                    if (fetchedRiwayat) {
                        riwayat = fetchedRiwayat;
                    }
                }
            }
            const isProduction = process.env.NODE_ENV === "production";
            const prefix = isProduction ? "" : "sbx_";

            return res.status(200).render("telegram/topup", {
                user: req.user || null,
                riwayat: riwayat || [],
                collection: `${prefix}transactions`,
                isSandbox: ApiConfig.MIDTRANS.IS_PRODUCTION
            });
        } catch (err) {
            next(err);
        }
    }

    async telegramNotif(req, res, next) {
        try {
            return res.status(200).render("telegram/order", { user: req.user || null, countries: {}, services: {} });
        } catch (err) {
            next(err);
        }
    }

    async telegramProfile(req, res, next) {
        try {
            if (!req.user || req.user === "undefined") {
                const telegram_ID = req.params.telegramId;

                if (telegram_ID) {
                    const foundUser = await firestoreService.getByField(
                        "users",
                        "telegram.uid",
                        String(telegram_ID)
                    );

                    if (foundUser) {
                        req.user = foundUser;
                    }
                }
            }

            return res
                .status(200)
                .render("telegram/profile", { user: req.user });
        } catch (err) {
            next(err);
        }
    }

    async telegramRiwayatOrder(req, res, next) {
        try {
            if (!req.user || req.user === "undefined") {
                const telegram_ID = req.params.telegramId;

                if (telegram_ID) {
                    const foundUser = await firestoreService.getByField(
                        "users",
                        "telegram.uid",
                        String(telegram_ID)
                    );

                    if (foundUser) {
                        req.user = foundUser;
                    }
                }
            }

            return res
                .status(200)
                .render("telegram/riwayat-order", { user: req.user });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new IndexController();

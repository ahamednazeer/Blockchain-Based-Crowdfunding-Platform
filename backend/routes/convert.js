const express = require("express");
const axios = require("axios");

const router = express.Router();

// Cache exchange rate for 5 minutes to avoid hitting API limits
const rateCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/convert?amount=100&from=USD&to=ETH
 * Convert fiat currency to ETH using CoinGecko free API.
 */
router.get("/", async (req, res) => {
    try {
        const { amount, from = "usd", to = "eth" } = req.query;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ error: "Valid positive amount is required" });
        }

        const fromCurrency = from.toLowerCase();

        // Fetch ETH price (cached)
        let ethPrice;
        let rateTimestamp;
        const now = Date.now();
        const cachedRate = rateCache.get(fromCurrency);

        if (cachedRate && now - cachedRate.timestamp < CACHE_DURATION) {
            ethPrice = cachedRate.rate;
            rateTimestamp = cachedRate.timestamp;
        } else {
            const response = await axios.get(
                "https://api.coingecko.com/api/v3/simple/price",
                {
                    params: {
                        ids: "ethereum",
                        vs_currencies: fromCurrency,
                    },
                }
            );

            ethPrice = response.data?.ethereum?.[fromCurrency];
            if (!ethPrice) {
                return res
                    .status(400)
                    .json({ error: `Unsupported currency: ${fromCurrency}` });
            }

            rateTimestamp = now;
            rateCache.set(fromCurrency, { rate: ethPrice, timestamp: rateTimestamp });
        }

        const ethAmount = Number(amount) / ethPrice;

        res.json({
            from: fromCurrency.toUpperCase(),
            to: "ETH",
            inputAmount: Number(amount),
            ethAmount: parseFloat(ethAmount.toFixed(8)),
            rate: ethPrice,
            rateTimestamp: new Date(rateTimestamp).toISOString(),
        });
    } catch (error) {
        console.error("Currency conversion error:", error.message);
        res.status(500).json({ error: "Failed to convert currency" });
    }
});

module.exports = router;

const express = require("express");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

/**
 * In-memory nonce store. Maps nonce -> { address, createdAt }.
 * Nonces expire after 5 minutes. This eliminates all DB lookup issues.
 */
const nonceStore = new Map();

function normalizePrivateKey(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function getConfiguredAdminAddress() {
    const rawConfiguredAdmin = (process.env.ADMIN_PRIVATE_KEY || process.env.ADMIN_ADDRESS || "").trim();
    if (!rawConfiguredAdmin) return null;
    if (ethers.isAddress(rawConfiguredAdmin)) {
        return rawConfiguredAdmin.toLowerCase();
    }
    const normalizedPk = normalizePrivateKey(rawConfiguredAdmin);
    if (/^0x[0-9a-fA-F]{64}$/.test(normalizedPk)) {
        return new ethers.Wallet(normalizedPk).address.toLowerCase();
    }
    return null;
}

function getExpectedAdminAddress() {
    // Prefer deployed on-chain admin metadata. This avoids granting admin UI role
    // to a wallet that cannot execute onlyAdmin contract methods.
    try {
        const deployedPath = path.join(__dirname, "../../blockchain/deployed-address.json");
        if (fs.existsSync(deployedPath)) {
            const deployedData = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
            if (deployedData.adminAddress && ethers.isAddress(deployedData.adminAddress)) {
                return deployedData.adminAddress.toLowerCase();
            }
        }
    } catch (err) {
        console.error("Error loading deployed admin address:", err.message);
    }

    return getConfiguredAdminAddress();
}

// Clean expired nonces every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [nonce, data] of nonceStore) {
        if (now - data.createdAt > 5 * 60 * 1000) {
            nonceStore.delete(nonce);
        }
    }
}, 5 * 60 * 1000);

/**
 * GET /api/auth/nonce?address=0x...
 *
 * Generates a fresh nonce and stores it in memory.
 * Returns the nonce and the exact message to sign.
 */
router.get("/nonce", async (req, res) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== "string") {
            return res.status(400).json({ error: "Wallet address is required" });
        }

        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: "Invalid Ethereum address" });
        }

        // Generate a fresh nonce every time
        const nonce = crypto.randomBytes(32).toString("hex");
        const message = `Sign this message to log in to CrowdChain.\n\nNonce: ${nonce}`;

        // Store in memory (not DB) to guarantee lookup works
        nonceStore.set(nonce, {
            address: address.toLowerCase(),
            createdAt: Date.now(),
        });

        console.log(`[Auth] Nonce issued for ${address.toLowerCase()}: ${nonce.substring(0, 16)}...`);

        res.json({ nonce, message });
    } catch (error) {
        console.error("Nonce generation error:", error);
        res.status(500).json({ error: "Failed to generate nonce" });
    }
});

/**
 * POST /api/auth/verify
 *
 * Verifies the MetaMask signature:
 * 1. Looks up nonce in memory store (guaranteed to exist if freshly issued)
 * 2. Reconstructs the signed message
 * 3. Recovers the signer address from the signature
 * 4. Creates/updates user with recovered address
 * 5. Issues JWT
 *
 * Body: { signature: string, nonce: string }
 */
router.post("/verify", async (req, res) => {
    try {
        const { signature, nonce } = req.body;

        if (!signature || !nonce) {
            return res
                .status(400)
                .json({ error: "Signature and nonce are required" });
        }

        // 1. Check nonce exists in memory store
        const nonceData = nonceStore.get(nonce);
        if (!nonceData) {
            console.log("[Auth] Nonce not found in store:", nonce.substring(0, 16) + "...");
            return res.status(401).json({ error: "Invalid or expired nonce. Please try again." });
        }

        // Delete nonce immediately (one-time use)
        nonceStore.delete(nonce);

        // Check expiry (5 min)
        if (Date.now() - nonceData.createdAt > 5 * 60 * 1000) {
            return res.status(401).json({ error: "Nonce expired. Please try again." });
        }

        // 2. Reconstruct the exact message
        const message = `Sign this message to log in to CrowdChain.\n\nNonce: ${nonce}`;

        // 3. Recover the signer address
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (err) {
            console.error("[Auth] Signature recovery failed:", err.message);
            return res.status(401).json({ error: "Invalid signature" });
        }

        const normalizedAddress = recoveredAddress.toLowerCase();
        console.log("[Auth] Recovered signer:", normalizedAddress);

        // 4. Find or create user by recovered address
        let user = await User.findOne({ walletAddress: normalizedAddress });
        if (!user) {
            user = await User.create({ walletAddress: normalizedAddress });
        }

        // Determine role
        let role = "user";
        try {
            const expectedAdmin = getExpectedAdminAddress();
            if (expectedAdmin && expectedAdmin === normalizedAddress) {
                role = "admin";
            }
        } catch (err) {
            console.error("Error checking admin:", err.message);
        }

        user.role = role;
        await user.save();

        // 5. Generate JWT
        const token = jwt.sign(
            {
                id: user._id,
                walletAddress: user.walletAddress,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        console.log("[Auth] SUCCESS:", normalizedAddress, "role:", role);

        res.json({
            token,
            user: {
                id: user._id,
                walletAddress: user.walletAddress,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Auth verify error:", error);
        res.status(500).json({ error: "Authentication failed" });
    }
});

/**
 * GET /api/auth/me
 */
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-__v -nonce");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
    } catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({ error: "Failed to get user" });
    }
});

module.exports = router;

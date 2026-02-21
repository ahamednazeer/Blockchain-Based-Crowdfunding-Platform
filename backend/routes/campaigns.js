const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const { auth, adminOnly } = require("../middleware/auth");
const { getContract, getAdminContract } = require("../config/contract");
const { ethers } = require("ethers");

const router = express.Router();

const LEGACY_READ_ABI = [
    "function getCampaigns() view returns (uint256[] memory, address[] memory, string[] memory, string[] memory, uint256[] memory, uint256[] memory, string[] memory, uint256[] memory, bool[] memory)",
    "function getCampaign(uint256 _id) view returns (uint256, address, string memory, string memory, uint256, uint256, string memory, uint256, bool, address[] memory, uint256[] memory)",
    "function getDonors(uint256 _id) view returns (address[] memory, uint256[] memory)",
    "function getCampaignCount() view returns (uint256)",
];

function mapContractReadError(error, fallbackMessage) {
    const code = error?.code || error?.cause?.code;
    const combinedMessage = `${error?.shortMessage || ""} ${error?.message || ""}`.toLowerCase();

    if (combinedMessage.includes("campaign does not exist")) {
        return { status: 404, error: "Campaign not found" };
    }

    if (combinedMessage.includes("only admin can perform this action")) {
        return {
            status: 403,
            error: "Configured backend admin wallet is not the contract admin. Reconnect with deployed admin wallet or redeploy with matching ADMIN_PRIVATE_KEY.",
        };
    }

    const rpcUnavailableCodes = new Set([
        "ECONNREFUSED",
        "ENOTFOUND",
        "ETIMEDOUT",
        "EHOSTUNREACH",
        "EPERM",
    ]);
    if (
        rpcUnavailableCodes.has(code) ||
        combinedMessage.includes("failed to detect network") ||
        combinedMessage.includes("missing response")
    ) {
        return {
            status: 503,
            error: "Blockchain node is unavailable. Ensure Ganache is running and GANACHE_URL is correct.",
        };
    }

    if (
        code === "BAD_DATA" ||
        code === "CALL_EXCEPTION" ||
        combinedMessage.includes("could not decode result data") ||
        combinedMessage.includes("execution reverted")
    ) {
        return {
            status: 503,
            error: "Smart contract call failed. Verify deployed-address.json and redeploy after Ganache reset.",
        };
    }

    return { status: 500, error: fallbackMessage };
}

function computePercentFunded(amountCollectedWei, goalWei) {
    const goal = BigInt(goalWei);
    if (goal <= 0n) return 0;
    const amount = BigInt(amountCollectedWei);
    const percent = (amount * 100n) / goal;
    return Number(percent > 100n ? 100n : percent);
}

function normalizePlatformState(rawState) {
    const [
        creationFeeWei,
        contractBalanceWei,
        campaignCount,
        commissionsCollectedWei,
        isPaused,
        isEmergencyStopped,
    ] = rawState;

    return {
        creationFeeWei: creationFeeWei.toString(),
        creationFeeEth: ethers.formatEther(creationFeeWei),
        contractBalanceWei: contractBalanceWei.toString(),
        contractBalanceEth: ethers.formatEther(contractBalanceWei),
        campaignCount: Number(campaignCount),
        commissionsCollectedWei: commissionsCollectedWei.toString(),
        commissionsCollectedEth: ethers.formatEther(commissionsCollectedWei),
        isPaused,
        isEmergencyStopped,
    };
}

function normalizeCampaignArrays(result) {
    // New contract shape (11 arrays)
    if (Array.isArray(result) && result.length >= 11) {
        return {
            ids: result[0],
            owners: result[1],
            titles: result[2],
            descriptions: result[3],
            categories: result[4],
            goals: result[5],
            deadlines: result[6],
            bannerCIDs: result[7],
            amountsCollected: result[8],
            createdAts: result[9],
            isActives: result[10],
        };
    }

    // Legacy contract shape (9 arrays)
    if (Array.isArray(result) && result.length >= 9) {
        const ids = result[0];
        const titles = result[2];
        return {
            ids,
            owners: result[1],
            titles,
            descriptions: result[3],
            categories: Array((ids || titles || []).length).fill("General"),
            goals: result[4],
            deadlines: result[5],
            bannerCIDs: result[6],
            amountsCollected: result[7],
            createdAts: Array((ids || titles || []).length).fill(0n),
            isActives: result[8],
        };
    }

    throw new Error("Unexpected getCampaigns return shape");
}

function normalizeSingleCampaign(result) {
    // New contract shape
    if (Array.isArray(result) && result.length >= 14) {
        return {
            id: result[0],
            owner: result[1],
            title: result[2],
            description: result[3],
            category: result[4],
            goal: result[5],
            deadline: result[6],
            bannerCID: result[7],
            amountCollected: result[8],
            createdAt: result[9],
            isActive: result[10],
            donators: result[11],
            donations: result[12],
            donationTimestamps: result[13],
        };
    }

    // Legacy contract shape
    if (Array.isArray(result) && result.length >= 11) {
        const donations = result[10] || [];
        return {
            id: result[0],
            owner: result[1],
            title: result[2],
            description: result[3],
            category: "General",
            goal: result[4],
            deadline: result[5],
            bannerCID: result[6],
            amountCollected: result[7],
            createdAt: 0n,
            isActive: result[8],
            donators: result[9] || [],
            donations,
            donationTimestamps: Array(donations.length).fill(0n),
        };
    }

    throw new Error("Unexpected getCampaign return shape");
}

function isLegacyMethodError(error) {
    const code = error?.code || error?.cause?.code;
    const message = `${error?.shortMessage || ""} ${error?.message || ""}`.toLowerCase();
    return (
        code === "BAD_DATA" ||
        code === "CALL_EXCEPTION" ||
        message.includes("could not decode result data") ||
        message.includes("execution reverted")
    );
}

function getLegacyReadContract(contract) {
    const provider = contract.runner?.provider;
    if (!provider) {
        throw new Error("Contract provider not available");
    }
    return new ethers.Contract(contract.target, LEGACY_READ_ABI, provider);
}

async function callReadCompat(contract, method, args = []) {
    try {
        return await contract[method](...args);
    } catch (error) {
        if (!isLegacyMethodError(error)) {
            throw error;
        }
        const legacyContract = getLegacyReadContract(contract);
        return await legacyContract[method](...args);
    }
}

async function getPlatformStateCompat(contract) {
    try {
        const rawState = await callReadCompat(contract, "getPlatformState");
        return normalizePlatformState(rawState);
    } catch (error) {
        if (!isLegacyMethodError(error)) {
            throw error;
        }

        const provider = contract.runner?.provider;
        const contractBalanceWei = provider
            ? await provider.getBalance(contract.target)
            : 0n;
        let campaignCount = 0;
        try {
            campaignCount = Number(await callReadCompat(contract, "getCampaignCount"));
        } catch {
            campaignCount = 0;
        }

        return {
            creationFeeWei: "0",
            creationFeeEth: "0.0",
            contractBalanceWei: contractBalanceWei.toString(),
            contractBalanceEth: ethers.formatEther(contractBalanceWei),
            campaignCount,
            commissionsCollectedWei: "0",
            commissionsCollectedEth: "0.0",
            isPaused: false,
            isEmergencyStopped: false,
            legacyContract: true,
        };
    }
}

function getPinataAuthHeaders() {
    const pinataJwt = process.env.PINATA_JWT;
    if (pinataJwt) {
        return { Authorization: `Bearer ${pinataJwt}` };
    }

    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_SECRET_API_KEY;
    if (pinataApiKey && pinataApiSecret) {
        return {
            pinata_api_key: pinataApiKey,
            pinata_secret_api_key: pinataApiSecret,
        };
    }

    return null;
}

// Multer config for banner uploads (temp storage before Pinata)
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
        }
    },
});

/**
 * POST /api/campaigns/upload-banner
 * Upload banner image to Pinata/IPFS. Returns CID.
 * Requires authentication.
 */
router.post("/upload-banner", auth, upload.single("banner"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Banner image is required" });
        }

        const pinataAuthHeaders = getPinataAuthHeaders();
        if (!pinataAuthHeaders) {
            return res.status(500).json({
                error: "Pinata credentials are not configured. Set PINATA_JWT (recommended) or PINATA_API_KEY/PINATA_SECRET_API_KEY.",
            });
        }

        const filePath = req.file.path;
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filePath), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const metadata = JSON.stringify({
            name: `campaign-banner-${Date.now()}`,
        });
        formData.append("pinataMetadata", metadata);

        const options = JSON.stringify({
            cidVersion: 1,
        });
        formData.append("pinataOptions", options);

        const pinataRes = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
                maxBodyLength: Infinity,
                headers: {
                    ...formData.getHeaders(),
                    ...pinataAuthHeaders,
                },
            }
        );

        // Clean up temp file
        fs.unlinkSync(filePath);

        res.json({
            cid: pinataRes.data.IpfsHash,
            url: `https://gateway.pinata.cloud/ipfs/${pinataRes.data.IpfsHash}`,
        });
    } catch (error) {
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        const upstreamStatus = error?.response?.status;
        const upstreamMessage =
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            error?.message;
        console.error("Banner upload error:", upstreamStatus || "", upstreamMessage);

        if (upstreamStatus === 401 || upstreamStatus === 403) {
            return res.status(502).json({
                error: "Pinata rejected credentials. Verify PINATA_JWT permissions or rotate credentials.",
            });
        }

        res.status(500).json({ error: "Failed to upload banner to IPFS" });
    }
});

/**
 * GET /api/campaigns/meta
 * Public contract metadata used by frontend (fees, pause/emergency state).
 */
router.get("/meta", async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }
        const state = await getPlatformStateCompat(contract);
        res.json(state);
    } catch (error) {
        console.error("Get campaign meta error:", error);
        const mapped = mapContractReadError(error, "Failed to fetch campaign metadata");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * GET /api/campaigns
 * Fetch all campaigns from the smart contract.
 */
router.get("/", async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }

        const provider = contract.runner?.provider;
        if (!provider || typeof provider.getCode !== "function") {
            return res.status(503).json({
                error: "Contract provider not available. Ensure blockchain connection is initialized.",
            });
        }

        const onChainCode = await provider.getCode(contract.target);
        if (!onChainCode || onChainCode === "0x") {
            return res.status(503).json({
                error: "No contract deployed at configured address. Redeploy and update deployed-address.json.",
            });
        }

        const result = await callReadCompat(contract, "getCampaigns");
        const {
            ids,
            owners,
            titles,
            descriptions,
            categories,
            goals,
            deadlines,
            bannerCIDs,
            amountsCollected,
            createdAts,
            isActives,
        } = normalizeCampaignArrays(result);

        const campaigns = [];
        for (let i = 0; i < ids.length; i++) {
            campaigns.push({
                id: Number(ids[i]),
                owner: owners[i],
                title: titles[i],
                description: descriptions[i],
                category: categories[i],
                goal: ethers.formatEther(goals[i]),
                goalWei: goals[i].toString(),
                deadline: Number(deadlines[i]),
                createdAt: Number(createdAts[i]),
                bannerCID: bannerCIDs[i],
                bannerUrl: bannerCIDs[i]
                    ? `https://gateway.pinata.cloud/ipfs/${bannerCIDs[i]}`
                    : null,
                amountCollected: ethers.formatEther(amountsCollected[i]),
                amountCollectedWei: amountsCollected[i].toString(),
                isActive: isActives[i],
                percentFunded: computePercentFunded(amountsCollected[i], goals[i]),
            });
        }

        res.json(campaigns);
    } catch (error) {
        console.error("Get campaigns error:", error);
        const mapped = mapContractReadError(error, "Failed to fetch campaigns");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * GET /api/campaigns/admin/state
 * Admin-only platform state for control panel.
 */
router.get("/admin/state", auth, adminOnly, async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }
        const state = await getPlatformStateCompat(contract);
        res.json(state);
    } catch (error) {
        console.error("Get admin state error:", error);
        const mapped = mapContractReadError(error, "Failed to fetch admin state");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * POST /api/campaigns/admin/pause
 * Admin-only: pause contract.
 */
router.post("/admin/pause", auth, adminOnly, async (req, res) => {
    try {
        const adminContract = getAdminContract();
        const tx = await adminContract.pauseContract();
        await tx.wait();
        res.json({ message: "Contract paused", txHash: tx.hash });
    } catch (error) {
        console.error("Pause contract error:", error);
        const mapped = mapContractReadError(error, "Failed to pause contract");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * POST /api/campaigns/admin/resume
 * Admin-only: resume contract.
 */
router.post("/admin/resume", auth, adminOnly, async (req, res) => {
    try {
        const adminContract = getAdminContract();
        const tx = await adminContract.resumeContract();
        await tx.wait();
        res.json({ message: "Contract resumed", txHash: tx.hash });
    } catch (error) {
        console.error("Resume contract error:", error);
        const mapped = mapContractReadError(error, "Failed to resume contract");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * POST /api/campaigns/admin/withdraw-commissions
 * Body: { amountEth?: string, to?: string }
 * Admin-only: withdraw platform commissions.
 */
router.post("/admin/withdraw-commissions", auth, adminOnly, async (req, res) => {
    try {
        const contract = getContract();
        const adminContract = getAdminContract();
        if (!contract || !adminContract) {
            return res.status(503).json({ error: "Contract not available" });
        }

        const amountEth = req.body?.amountEth;
        const to = req.body?.to || req.user.walletAddress;
        if (!ethers.isAddress(to)) {
            return res.status(400).json({ error: "Invalid recipient address" });
        }

        const platformState = await getPlatformStateCompat(contract);
        const contractBalanceWei = BigInt(platformState.contractBalanceWei);
        const amountWei = amountEth ? ethers.parseEther(amountEth) : contractBalanceWei;
        if (amountWei <= 0n) {
            return res.status(400).json({ error: "Amount must be greater than zero" });
        }
        if (amountWei > contractBalanceWei) {
            return res.status(400).json({ error: "Requested amount exceeds contract balance" });
        }

        const tx = await adminContract.withdrawCommissions(to, amountWei);
        await tx.wait();

        res.json({
            message: "Commissions withdrawn",
            txHash: tx.hash,
            to,
            amountWei: amountWei.toString(),
            amountEth: ethers.formatEther(amountWei),
        });
    } catch (error) {
        console.error("Withdraw commissions error:", error);
        const mapped = mapContractReadError(error, "Failed to withdraw commissions");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * POST /api/campaigns/admin/emergency-stop
 * Body: { to?: string }
 * Admin-only: withdraw contract balance and permanently stop contract.
 */
router.post("/admin/emergency-stop", auth, adminOnly, async (req, res) => {
    try {
        const adminContract = getAdminContract();
        const to = req.body?.to || req.user.walletAddress;
        if (!ethers.isAddress(to)) {
            return res.status(400).json({ error: "Invalid recipient address" });
        }

        const tx = await adminContract.emergencyWithdrawAndStop(to);
        await tx.wait();

        res.json({
            message: "Emergency withdrawal completed. Contract permanently stopped.",
            txHash: tx.hash,
            to,
        });
    } catch (error) {
        console.error("Emergency stop error:", error);
        const mapped = mapContractReadError(error, "Failed to execute emergency stop");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * GET /api/campaigns/:id
 * Fetch a single campaign with donor info.
 */
router.get("/:id", async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }

        const campaignId = parseInt(req.params.id);
        if (Number.isNaN(campaignId) || campaignId < 0) {
            return res.status(400).json({ error: "Invalid campaign id" });
        }
        const result = await callReadCompat(contract, "getCampaign", [campaignId]);
        const {
            id,
            owner,
            title,
            description,
            category,
            goal,
            deadline,
            bannerCID,
            amountCollected,
            createdAt,
            isActive,
            donators,
            donations,
            donationTimestamps,
        } = normalizeSingleCampaign(result);

        const campaign = {
            id: Number(id),
            owner,
            title,
            description,
            category,
            goal: ethers.formatEther(goal),
            goalWei: goal.toString(),
            deadline: Number(deadline),
            createdAt: Number(createdAt),
            bannerCID,
            bannerUrl: bannerCID
                ? `https://gateway.pinata.cloud/ipfs/${bannerCID}`
                : null,
            amountCollected: ethers.formatEther(amountCollected),
            amountCollectedWei: amountCollected.toString(),
            isActive,
            percentFunded: computePercentFunded(amountCollected, goal),
            donors: donators.map((addr, idx) => ({
                address: addr,
                amount: ethers.formatEther(donations[idx]),
                amountWei: donations[idx].toString(),
                timestamp: Number(donationTimestamps[idx] || 0),
            })),
            totalDonors: donators.length,
        };

        res.json(campaign);
    } catch (error) {
        console.error("Get campaign error:", error);
        const mapped = mapContractReadError(error, "Failed to fetch campaign");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * DELETE /api/campaigns/:id
 * Admin-only: soft-delete a campaign via smart contract.
 */
router.delete("/:id", auth, adminOnly, async (req, res) => {
    try {
        const adminContract = getAdminContract();
        const campaignId = parseInt(req.params.id);
        if (Number.isNaN(campaignId) || campaignId < 0) {
            return res.status(400).json({ error: "Invalid campaign id" });
        }

        const tx = await adminContract.deleteCampaign(campaignId);
        await tx.wait();

        res.json({ message: "Campaign deleted successfully", txHash: tx.hash });
    } catch (error) {
        console.error("Delete campaign error:", error);
        const mapped = mapContractReadError(error, "Failed to delete campaign");
        res.status(mapped.status).json({ error: mapped.error });
    }
});

module.exports = router;

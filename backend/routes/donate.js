const express = require("express");
const { getContract } = require("../config/contract");
const { auth } = require("../middleware/auth");
const { ethers } = require("ethers");

const router = express.Router();

const LEGACY_READ_ABI = [
    "function getCampaigns() view returns (uint256[] memory, address[] memory, string[] memory, string[] memory, uint256[] memory, uint256[] memory, string[] memory, uint256[] memory, bool[] memory)",
    "function getCampaign(uint256 _id) view returns (uint256, address, string memory, string memory, uint256, uint256, string memory, uint256, bool, address[] memory, uint256[] memory)",
    "function getDonors(uint256 _id) view returns (address[] memory, uint256[] memory)",
];

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

function parseDonorResult(result) {
    if (!Array.isArray(result) || result.length < 2) {
        return {
            donators: [],
            donations: [],
            donationTimestamps: [],
        };
    }

    const tuple = Array.from(result);
    const donators = Array.isArray(tuple[0]) ? tuple[0] : [];
    const donations = Array.isArray(tuple[1]) ? tuple[1] : [];
    const donationTimestamps = tuple.length > 2 && Array.isArray(tuple[2])
        ? tuple[2]
        : Array(donations.length).fill(0n);

    return {
        donators,
        donations,
        donationTimestamps,
    };
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

/**
 * GET /api/donations/user/:address
 * Fetch all contribution history for a user wallet.
 * Requires authentication and self/admin access.
 */
router.get("/user/:address", auth, async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }

        const address = (req.params.address || "").toLowerCase();
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: "Invalid wallet address" });
        }

        const requesterAddress = (req.user.walletAddress || "").toLowerCase();
        const isRequesterAdmin = req.user.role === "admin";
        if (!isRequesterAdmin && requesterAddress !== address) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const contributions = [];
        try {
            const [campaignIds, amounts, timestamps] = await contract.getUserContributions(address);
            const titleCache = new Map();

            for (let i = 0; i < campaignIds.length; i++) {
                const campaignId = Number(campaignIds[i]);
                const amountWei = amounts[i];
                const timestamp = Number(timestamps[i] || 0);

                let campaignTitle = titleCache.get(campaignId);
                if (!campaignTitle) {
                    try {
                        const campaign = await callReadCompat(contract, "getCampaign", [campaignId]);
                        campaignTitle = campaign[2];
                    } catch {
                        campaignTitle = `Campaign #${campaignId}`;
                    }
                    titleCache.set(campaignId, campaignTitle);
                }

                contributions.push({
                    campaignId,
                    campaignTitle,
                    amountWei: amountWei.toString(),
                    amount: ethers.formatEther(amountWei),
                    timestamp,
                });
            }
        } catch (error) {
            if (!isLegacyMethodError(error)) {
                throw error;
            }

            // Backward compatibility for legacy contract without getUserContributions.
            const campaignListResult = await callReadCompat(contract, "getCampaigns");
            const campaignIds = campaignListResult[0] || [];
            const campaignTitles = campaignListResult[2] || [];

            for (let i = 0; i < campaignIds.length; i++) {
                const campaignId = Number(campaignIds[i]);
                const title = campaignTitles[i] || `Campaign #${campaignId}`;
                const donorResult = await callReadCompat(contract, "getDonors", [campaignId]);
                const { donators, donations, donationTimestamps } = parseDonorResult(donorResult);

                for (let j = 0; j < donators.length; j++) {
                    if ((donators[j] || "").toLowerCase() !== address) continue;
                    const amountWei = donations[j];
                    contributions.push({
                        campaignId,
                        campaignTitle: title,
                        amountWei: amountWei.toString(),
                        amount: ethers.formatEther(amountWei),
                        timestamp: Number(donationTimestamps[j] || 0),
                    });
                }
            }
        }

        contributions.sort((a, b) => b.timestamp - a.timestamp);

        const totalWei = contributions.reduce(
            (sum, entry) => sum + BigInt(entry.amountWei),
            0n
        );
        const averageWei = contributions.length > 0
            ? totalWei / BigInt(contributions.length)
            : 0n;

        res.json({
            walletAddress: address,
            totalContributions: contributions.length,
            totalAmountWei: totalWei.toString(),
            totalAmount: ethers.formatEther(totalWei),
            averageContributionWei: averageWei.toString(),
            averageContribution: ethers.formatEther(averageWei),
            contributions,
        });
    } catch (error) {
        console.error("Get user contributions error:", error);
        res.status(500).json({ error: "Failed to fetch contribution history" });
    }
});

/**
 * GET /api/donations/:campaignId
 * Fetch donation history for a campaign from blockchain.
 */
router.get("/:campaignId", async (req, res) => {
    try {
        const contract = getContract();
        if (!contract) {
            return res.status(503).json({ error: "Contract not available" });
        }

        const campaignId = parseInt(req.params.campaignId);
        const donorResult = await callReadCompat(contract, "getDonors", [campaignId]);
        const { donators, donations, donationTimestamps } = parseDonorResult(donorResult);

        const donorList = donators.map((addr, idx) => ({
            address: addr,
            amount: ethers.formatEther(donations[idx]),
            amountWei: donations[idx].toString(),
            timestamp: Number(donationTimestamps[idx] || 0),
        }));

        res.json({
            campaignId,
            totalDonors: donorList.length,
            totalAmount: ethers.formatEther(
                donations.reduce((sum, d) => sum + d, 0n)
            ),
            donors: donorList,
        });
    } catch (error) {
        console.error("Get donations error:", error);
        res.status(500).json({ error: "Failed to fetch donations" });
    }
});

module.exports = router;

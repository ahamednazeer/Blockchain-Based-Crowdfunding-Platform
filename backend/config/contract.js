const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let provider;
let contract;
let contractAddress;

function getContractArtifact() {
    const artifactPath = path.join(
        __dirname,
        "../../blockchain/artifacts/contracts/CrowdFunding.sol/CrowdFunding.json"
    );
    if (!fs.existsSync(artifactPath)) {
        throw new Error("Contract artifact not found. Compile the contract first.");
    }
    return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

/**
 * Initialize ethers provider and contract instance.
 * Reads ABI from compiled artifacts and deployed address from deploy output.
 */
function initContract() {
    try {
        // Provider connected to Ganache
        provider = new ethers.JsonRpcProvider(
            process.env.GANACHE_URL || "http://127.0.0.1:7545"
        );

        // Read deployed contract address
        const deployedPath = path.join(
            __dirname,
            "../../blockchain/deployed-address.json"
        );
        if (!fs.existsSync(deployedPath)) {
            console.warn(
                "deployed-address.json not found. Deploy the contract first."
            );
            return null;
        }
        const deployedData = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
        contractAddress = process.env.CONTRACT_ADDRESS || deployedData.contractAddress;

        // Read ABI from compiled artifacts
        const artifact = getContractArtifact();

        // Create contract instance (read-only by default)
        contract = new ethers.Contract(contractAddress, artifact.abi, provider);

        console.log("Contract initialized at:", contractAddress);
        return contract;
    } catch (error) {
        console.error("Failed to initialize contract:", error.message);
        return null;
    }
}

/**
 * Get a signer for admin operations (using admin private key).
 */
function getAdminSigner() {
    if (!provider) {
        throw new Error("Provider not initialized");
    }
    const raw = (process.env.ADMIN_PRIVATE_KEY || "").trim();
    if (!raw) {
        throw new Error("ADMIN_PRIVATE_KEY not set in environment");
    }

    // Support Ganache unlocked-account flow when env stores address.
    if (ethers.isAddress(raw)) {
        return provider.getSigner(raw);
    }

    const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
        throw new Error(
            "ADMIN_PRIVATE_KEY must be a wallet address (unlocked Ganache account) or 32-byte private key"
        );
    }

    return new ethers.Wallet(normalized, provider);
}

/**
 * Get the contract instance connected with admin signer.
 */
function getAdminContract() {
    const signer = getAdminSigner();
    const artifact = getContractArtifact();
    return new ethers.Contract(contractAddress, artifact.abi, signer);
}

module.exports = {
    initContract,
    getProvider: () => provider,
    getContract: () => contract,
    getAdminSigner,
    getAdminContract,
    getContractAddress: () => contractAddress,
};

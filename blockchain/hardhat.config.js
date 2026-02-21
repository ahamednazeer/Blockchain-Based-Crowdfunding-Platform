const path = require("path");
// Load .env from blockchain dir first, then fall back to backend .env
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });
require("@nomicfoundation/hardhat-toolbox");

const rawPrivateKey = (process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim();
const privateKey = /^0x[0-9a-fA-F]{64}$/.test(rawPrivateKey)
    ? rawPrivateKey
    : /^[0-9a-fA-F]{64}$/.test(rawPrivateKey)
        ? `0x${rawPrivateKey}`
        : null;
const usePrivateKeySigner = String(process.env.HARDHAT_USE_PRIVATE_KEY_SIGNER || "").toLowerCase() === "true";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    networks: {
        ganache: {
            url: process.env.GANACHE_URL || "http://127.0.0.1:7545",
            // Default: use node-managed unlocked accounts (Ganache) so deploy can use funded wallets.
            // Opt in to private-key signer mode only when explicitly requested.
            ...(privateKey && usePrivateKeySigner
                ? { accounts: [privateKey] }
                : {}),
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

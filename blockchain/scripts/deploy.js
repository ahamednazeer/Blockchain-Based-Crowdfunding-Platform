const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Updates or creates key=value pairs in a .env file.
 * If the key exists, its value is replaced. Otherwise, the key is appended.
 */
function updateEnvFile(filePath, updates) {
    let content = "";
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, "utf8");
    }

    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content = content.trimEnd() + `\n${key}=${value}\n`;
        }
    }

    fs.writeFileSync(filePath, content);
    console.log("  [OK] Updated:", filePath);
}

function normalizePrivateKey(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function resolveAdminAddress(defaultAddress) {
    const raw = (process.env.ADMIN_PRIVATE_KEY || process.env.ADMIN_ADDRESS || "").trim();
    if (!raw) {
        return { adminAddress: defaultAddress, source: "deployer" };
    }

    if (hre.ethers.isAddress(raw)) {
        return { adminAddress: raw, source: "ADMIN_PRIVATE_KEY/ADMIN_ADDRESS (address)" };
    }

    const normalizedPk = normalizePrivateKey(raw);
    if (/^0x[0-9a-fA-F]{64}$/.test(normalizedPk)) {
        const wallet = new hre.ethers.Wallet(normalizedPk);
        return { adminAddress: wallet.address, source: "ADMIN_PRIVATE_KEY (private key)" };
    }

    console.warn("  [WARN] ADMIN_PRIVATE_KEY/ADMIN_ADDRESS is invalid. Falling back to deployer as admin.");
    return { adminAddress: defaultAddress, source: "deployer (fallback)" };
}


async function main() {
    console.log("Deploying CrowdFunding contract...\n");

    const signers = await hre.ethers.getSigners();
    console.log("  Signers found:", signers.length);

    if (signers.length === 0) {
        throw new Error("No signers available. Check Ganache connection and Hardhat config.");
    }

    // Pick the signer with the highest ETH balance so deploy does not fail
    // when account[0] has been drained in a persistent Ganache DB.
    const signerWithBalances = [];
    for (const signer of signers) {
        const balance = await hre.ethers.provider.getBalance(signer.address);
        signerWithBalances.push({ signer, balance });
    }
    signerWithBalances.sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));

    const deployer = signerWithBalances[0].signer;
    const deployerBalance = signerWithBalances[0].balance;
    const { adminAddress, source: adminSource } = resolveAdminAddress(deployer.address);
    const creationFeeEth = process.env.CAMPAIGN_CREATION_FEE_ETH || "0.01";
    const creationFeeWei = hre.ethers.parseEther(creationFeeEth);

    if (deployerBalance <= 0n) {
        throw new Error(
            "All available signers have zero ETH. Fund a Ganache account or reset chain data before deploying."
        );
    }

    console.log("  Deployer address:", deployer.address);
    console.log("  Admin address:", adminAddress);
    console.log("  Admin source:", adminSource);
    console.log("  Campaign creation fee:", creationFeeEth, "ETH");
    console.log("  Selected deployer balance:", hre.ethers.formatEther(deployerBalance), "ETH");

    if (deployer.address !== signers[0].address) {
        console.log("  [INFO] account[0] had lower balance. Using a funded account for deployment.\n");
    } else {
        console.log("");
    }

    // Deploy the contract with the admin address
    console.log("  Getting contract factory...");
    const CrowdFunding = await hre.ethers.getContractFactory("CrowdFunding", deployer);

    console.log("  Deploying contract...");
    const crowdFunding = await CrowdFunding.deploy(adminAddress, creationFeeWei);

    console.log("  Waiting for deployment confirmation...");
    await crowdFunding.waitForDeployment();

    const contractAddress = await crowdFunding.getAddress();

    console.log("\n  [OK] CrowdFunding deployed to:", contractAddress);
    console.log("  [OK] Admin set to:", adminAddress);
    console.log("  [OK] Campaign creation fee set to:", creationFeeEth, "ETH");

    // Save deployed address for backend/frontend consumption
    const deployedData = {
        contractAddress,
        adminAddress,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
    };

    const outputPath = path.join(__dirname, "..", "deployed-address.json");
    fs.writeFileSync(outputPath, JSON.stringify(deployedData, null, 2));
    console.log("\n  Deployment info saved to:", outputPath);

    // ── Auto-update .env files ──────────────────────────────────────
    const rootDir = path.join(__dirname, "..", "..");

    // Update backend/.env
    const backendEnvPath = path.join(rootDir, "backend", ".env");
    updateEnvFile(backendEnvPath, {
        CONTRACT_ADDRESS: contractAddress,
    });

    // Update frontend/.env.local
    const frontendEnvPath = path.join(rootDir, "frontend", ".env.local");
    updateEnvFile(frontendEnvPath, {
        NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress,
    });

    console.log("\n  [OK] All .env files updated automatically.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\nDeployment failed:", error.message || error);
        process.exit(1);
    });

const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../../backend/.env") });
const { ethers } = require("ethers");

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i]).replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-");
        if (token.startsWith("--")) {
            const kvIndex = token.indexOf("=");
            if (kvIndex > 2) {
                const key = token.slice(2, kvIndex);
                const value = token.slice(kvIndex + 1);
                args[key] = value;
                continue;
            }

            const key = token.slice(2);
            const value = argv[i + 1];
            if (!value || String(value).startsWith("-")) {
                args[key] = true;
            } else {
                args[key] = value;
                i++;
            }
        } else if (token === "-h") {
            args.h = true;
        } else if (token.startsWith("-")) {
            // Ignore unsupported short flags to avoid treating them as positional.
            continue;
        } else {
            args._.push(token);
        }
    }
    return args;
}

function printUsage() {
    console.log(`
Usage:
  npm run -s send:eth -- --to <wallet_address> --amount <eth_amount> [--pk <private_key>] [--rpc <url>]

Examples:
  npm run -s send:eth -- --to 0x1234...abcd --amount 0.05
  npm run -s send:eth -- --to 0x1234...abcd --amount 1 --pk 0xabc...
  npm run -s send:eth -- --to 0x1234...abcd --amount 0.1 --rpc http://127.0.0.1:7545

Env fallback:
  Uses ADMIN_PRIVATE_KEY or PRIVATE_KEY from .env if --pk is not provided.
  Value can be either a private key, or an unlocked Ganache sender address.
  Uses GANACHE_URL if --rpc is not provided.
`);
}

function normalizePrivateKey(input) {
    if (!input) return "";
    const trimmed = String(input).trim().replace(/^['"]|['"]$/g, "");
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function normalizeArgValue(input) {
    if (input === undefined || input === null) return "";
    return String(input).trim().replace(/^['"]|['"]$/g, "");
}

async function getBestUnlockedSigner(provider, minBalanceWei = 0n) {
    const accounts = await provider.send("eth_accounts", []);
    if (!Array.isArray(accounts) || accounts.length === 0) {
        return null;
    }

    let highest = null;
    let highestMeetingMin = null;
    for (const account of accounts) {
        const balance = await provider.getBalance(account);
        if (!highest || balance > highest.balance) {
            highest = { account, balance };
        }
        if (balance >= minBalanceWei && (!highestMeetingMin || balance > highestMeetingMin.balance)) {
            highestMeetingMin = { account, balance };
        }
    }

    const selected = highestMeetingMin || highest;
    if (!selected) return null;

    const signer = await provider.getSigner(selected.account);
    return {
        signer,
        address: selected.account,
        balance: selected.balance,
        meetsMin: selected.balance >= minBalanceWei,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help || args.h) {
        printUsage();
        return;
    }

    // Windows shells/npm can forward args differently, so support multiple sources.
    const to = normalizeArgValue(args.to || process.env.npm_config_to || args._[0]);
    const amount = normalizeArgValue(args.amount || process.env.npm_config_amount || args._[1]);
    const rpcUrl = normalizeArgValue(args.rpc || process.env.npm_config_rpc || process.env.GANACHE_URL || "http://127.0.0.1:7545");
    const privateKeyInput = normalizeArgValue(
        args.pk || process.env.npm_config_pk || process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY
    );
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    if (!to || !amount) {
        printUsage();
        throw new Error(
            `Missing required arguments: --to and --amount (received argv: ${JSON.stringify(process.argv.slice(2))})`
        );
    }

    if (!ethers.isAddress(to)) {
        throw new Error("Invalid --to wallet address");
    }

    let valueWei;
    try {
        valueWei = ethers.parseEther(amount);
    } catch {
        throw new Error("Invalid --amount. Example: 0.05");
    }

    if (valueWei <= 0n) {
        throw new Error("--amount must be greater than 0");
    }

    let signer;
    let signerHint = "";
    const isPlaceholderKey = !privateKeyInput || /your_ganache_.*_private_key_here/i.test(privateKeyInput);

    if (isPlaceholderKey) {
        const unlocked = await getBestUnlockedSigner(provider, valueWei);
        if (!unlocked) {
            throw new Error("Missing private key and no unlocked Ganache accounts available. Set ADMIN_PRIVATE_KEY/PRIVATE_KEY or pass --pk.");
        }
        signer = unlocked.signer;
        signerHint = `[WARN] No private key provided. Using unlocked Ganache account ${unlocked.address}.`;
        if (!unlocked.meetsMin) {
            signerHint += " Selected account may have insufficient balance for requested amount + gas.";
        }
    } else {
        const credential = String(privateKeyInput).trim();
        if (ethers.isAddress(credential)) {
            try {
                signer = await provider.getSigner(credential);
                await signer.getAddress();
            } catch {
                const unlocked = await getBestUnlockedSigner(provider, valueWei);
                if (!unlocked) {
                    throw new Error(
                        "ADMIN_PRIVATE_KEY is set as an address, but RPC does not expose it as an unlocked account. Set a real private key (0x + 64 hex) or unlock that account in Ganache."
                    );
                }
                signer = unlocked.signer;
                signerHint = `[WARN] ${credential} is not unlocked on this RPC. Falling back to unlocked account ${unlocked.address}.`;
                if (!unlocked.meetsMin) {
                    signerHint += " Selected account may have insufficient balance for requested amount + gas.";
                }
            }
        } else {
            const privateKey = normalizePrivateKey(credential);
            if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
                throw new Error(
                    "Invalid private key format. Expected 32-byte hex key (64 hex chars, optional 0x prefix)."
                );
            }
            signer = new ethers.Wallet(privateKey, provider);
        }
    }

    const fromAddress = await signer.getAddress();

    const [network, fromBalance] = await Promise.all([
        provider.getNetwork(),
        provider.getBalance(fromAddress),
    ]);

    console.log("RPC:", rpcUrl);
    console.log("Chain ID:", network.chainId.toString());
    console.log("From:", fromAddress);
    console.log("To:", to);
    console.log("Amount:", amount, "ETH");
    console.log("Balance:", ethers.formatEther(fromBalance), "ETH");
    if (signerHint) {
        console.log(signerHint);
    }

    if (fromBalance <= valueWei) {
        throw new Error(
            `Insufficient sender balance for amount + gas. Sender balance: ${ethers.formatEther(fromBalance)} ETH`
        );
    }

    const gasPrice = await provider.getFeeData();
    const tx = await signer.sendTransaction({
        to,
        value: valueWei,
    });

    console.log("Tx hash:", tx.hash);
    if (gasPrice.gasPrice) {
        console.log("Gas price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
    }

    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
}

main().catch((error) => {
    console.error("Send ETH failed:", error.message || error);
    process.exit(1);
});

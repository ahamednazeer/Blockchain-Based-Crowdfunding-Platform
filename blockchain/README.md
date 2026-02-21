# Blockchain Scripts

## Persistent Ganache (Keep Campaign Data)

Use persistent mode so campaigns survive Ganache restarts.

### Start persistent chain

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Crowdfunding-Platform/blockchain
npm run chain:start
```

This stores chain state in `./.ganache-db`.

### First-time setup

After first start (or after reset), deploy once:

```bash
npm run deploy
```

Then restart backend and frontend so updated contract address/env values are loaded.

Admin address used at deploy time:
- If `ADMIN_PRIVATE_KEY` is set to a private key, that wallet address becomes contract admin.
- If `ADMIN_PRIVATE_KEY` (or `ADMIN_ADDRESS`) is an address, that address becomes contract admin.
- Otherwise deployer wallet is used.

Hardhat signer mode:
- By default, deploy uses Ganache unlocked accounts (funded node accounts).
- To force private-key signer mode, set `HARDHAT_USE_PRIVATE_KEY_SIGNER=true`.

If deploy fails with `insufficient funds for gas * price + value`, your current account has no ETH.
The deploy script now auto-selects the highest-balance signer from Ganache.
If all accounts are empty, run:

```bash
npm run chain:reset
npm run chain:start
npm run deploy
```

### Useful chain commands

```bash
# Start fresh volatile chain (no persistence)
npm run chain:start:fresh

# Delete persistent chain data
npm run chain:reset
```

## Send ETH From Ganache

Use the helper script to transfer ETH from a funded Ganache account to any wallet.

### Command

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Crowdfunding-Platform/blockchain
npm run -s send:eth -- --to <WALLET_ADDRESS> --amount <ETH_AMOUNT>
```

### Example

```bash
npm run -s send:eth -- --to 0xAbC1234Ef5678901234567890aBcDEF123456789 --amount 0.1
```

### Optional Flags

- `--pk <PRIVATE_KEY>`: Override sender private key from CLI.
- `--rpc <RPC_URL>`: Override RPC URL (default is `GANACHE_URL` or `http://127.0.0.1:7545`).

Example:

```bash
npm run -s send:eth -- --to 0xAbC1234Ef5678901234567890aBcDEF123456789 --amount 0.1 --rpc http://127.0.0.1:7545
```

### Environment Fallback

If `--pk` is not passed, the script uses:

1. `ADMIN_PRIVATE_KEY`
2. `PRIVATE_KEY`

from `.env` (or `../backend/.env`).

`ADMIN_PRIVATE_KEY` / `PRIVATE_KEY` can be:

1. A private key (`0x` + 64 hex chars)
2. An unlocked Ganache account address (`0x` + 40 hex chars)

If `--rpc` is not passed, the script uses:

1. `GANACHE_URL`
2. `http://127.0.0.1:7545`

If `ADMIN_PRIVATE_KEY` is configured as an address that is not unlocked on the current RPC,
the script will automatically fall back to the best unlocked Ganache account.

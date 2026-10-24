# Cyber Fortune God Contracts

On-chain contracts for **Cyber Fortune God (财神爷求签)** — a daily incense-and-fortune-stick ritual on BNB Smart Chain.

[Website](https://caishenye.net) · [Sparkler Labs](https://sparklerlabs.com) · [MIT License](LICENSE)

> **Status:** live on BNB Smart Chain. The contracts have not been independently audited. See [Security](#security).

## Overview

Three contracts power the ritual:

| Contract | Standard | Upgradeable | Role |
| --- | --- | --- | --- |
| `CyberFortuneGod` | `OwnableUpgradeable` | Yes, via transparent proxy (`CFG`) | Incense offering, MERIT issuance, fortune-stick drawing, economics |
| `MeritCoin` | ERC-20 | No | `MERIT` merit token; minted only by `CyberFortuneGod`, burnable by holders |
| `FortuneStick` | ERC-721Enumerable | No | Fortune-stick NFT; minted only by `CyberFortuneGod` |

A user offers incense with the chain's native coin and receives `MERIT`. Spending 8 `MERIT` draws a fortune-stick NFT. The stick number is derived on-chain; metadata is served from a configurable base URI.

## Live deployment

### BNB Smart Chain (chain ID 56)

| Contract | Address |
| --- | --- |
| `CyberFortuneGod` proxy (`CFG`) | [`0x6f75123c4C486FA46c017022AE3837cBF71C2273`](https://bscscan.com/address/0x6f75123c4C486FA46c017022AE3837cBF71C2273) |
| `CyberFortuneGod` implementation | [`0x1A26Ee3f3dd87d03EF26e06eb07c14D2e8e6Ae7B`](https://bscscan.com/address/0x1A26Ee3f3dd87d03EF26e06eb07c14D2e8e6Ae7B) |
| `MeritCoin` | [`0xAC57C317C024a3e152b236313Cf53a16F47b8813`](https://bscscan.com/address/0xAC57C317C024a3e152b236313Cf53a16F47b8813) |
| `FortuneStick` | [`0x9DD13F14E569e94FdA43288711D59D90083e3715`](https://bscscan.com/address/0x9DD13F14E569e94FdA43288711D59D90083e3715) |
| `ProxyAdmin` | [`0xEeDEDa095c301DD94441a5a7BA12Fc0833fBB494`](https://bscscan.com/address/0xEeDEDa095c301DD94441a5a7BA12Fc0833fBB494) |

Live parameters:

| Parameter | Value |
| --- | --- |
| `startTime` | `1719698400` (2024-06-30 06:00 UTC+8) |
| `decreaseCoefficient` | `1.04491013` |
| `totalSupplyByDay` | `888` MERIT |
| `mintPrice` | `0.002` BNB |
| `drawFortune` cost | `8` MERIT |
| Max `offeringIncense` calls per address per day | `3` |
| Stick number range | `1–60` |

Metadata for this deployment is served from `https://nft.caishenye.net/api/v2/chains/56/nfts/0x9DD13F14E569e94FdA43288711D59D90083e3715/metadata`.

Deployment records, including ABIs and transaction hashes, are checked in under `deployments/bsc`.

## How it works

### 1. Offer incense

`CyberFortuneGod.offeringIncense()` is payable:

- The caller must send at least `mintPrice` native coin. **Excess payment is not refunded** and remains in the contract.
- Each address can call it at most three times per day.
- On the first successful call of a new day, the daily supply counter resets to `totalSupplyByDay`.
- The first four successful calls of the day receive `88`, `66`, `36`, and `30` MERIT, in global order.
- From the fifth call onward, the amount is the previous amount divided by `decreaseCoefficient`, rounded down.
- If the daily supply is exhausted, the call reverts with `CyberFortuneGod: Today's MERIT has been distributed out`.
- Before `startTime`, `getDays()` underflows and the call reverts.

`getDays()` returns `(block.timestamp - startTime) / 1 days`. `getOfferingIncenseFrequency(user)` returns how many incense calls the user has left today.

#### Daily issuance schedule

With `decreaseCoefficient = 1.04491013`, each day's sequence is:

```text
88, 66, 36, 30, 30/1.04491013, 30/1.04491013², ...
```

The infinite series converges to `888`, which is why `totalSupplyByDay` is `888`. The contract caps the final issuance at `remainingSupply`, so the daily total never exceeds the cap; when demand is sufficient, the final call receives the remainder and the day reaches `888`. The first four calls of each day reset the sequence to `88, 66, 36, 30`; the same schedule repeats every day. Unused daily supply does not carry over.

With a much larger daily cap or a larger `decreaseCoefficient`, the decayed amount can eventually round to zero; calls beyond the first four of that day then revert. With the live parameters, the `888` cap is reached first.

### 2. Draw a fortune stick

`CyberFortuneGod.drawFortune()`:

1. Requires the caller's `MERIT` allowance to `CyberFortuneGod` to be at least `8 MERIT`.
2. Transfers `8 MERIT` from the caller to the contract.
3. Burns the `8 MERIT`.
4. Calls `FortuneStick.draw(caller)`.

The NFT is minted with a sequential `tokenId` (starting at `0`). The contract records:

- `tokenMinter[tokenId]` — the original drawer; it does not change when the NFT is transferred.
- `mintTime[tokenId]` — the mint timestamp.

`FortuneStick.draw` is restricted to the configured `minter`, which is the `CyberFortuneGod` proxy.

### 3. Stick number and metadata

`FortuneStick.getStickNo(tokenId)` returns `(originalDrawer, stickNo)`:

```solidity
stickNo = (uint256(
  keccak256(
    abi.encodePacked(
      address(this),
      tokenId.toString(),
      originalDrawer,
      mintTime.toString()
    )
  )
) % 60) + 1;
```

The result is in `[1, 60]`.

`tokenURI(tokenId)` is:

```text
{baseURI}/{tokenId}/{stickNo}_{originalDrawer}_{mintTime}.json
```

`baseURI` is set by the `FortuneStick` owner and can be changed, so metadata is not immutable. If `baseURI` is empty, `tokenURI` returns an empty string.

## Contracts

### `CyberFortuneGod`

The main logic contract. It is upgraded through a transparent proxy.

State:

- `meritCoin`, `fortuneStick` — bound once by the owner after deployment.
- `startTime`, `totalSupplyByDay`, `decreaseCoefficient`, `mintPrice` — economic parameters.
- `remainingSupply` — the current day's remaining issuance.
- `lastDecrement` — the amount issued by the previous call.
- `mintNum[day]` — successful mints per day.
- `updateSupplyByDay[day]` — whether the day's supply has been initialized.
- `userMintNumByDay[day][user]` — mints per address per day.

Owner functions:

- `initMeritCoin(address)` / `initFortuneStick(address)` — one-time bindings; normally called by the deploy scripts.
- `setMintPrice(uint256)`, `setTotalSupplyByDay(uint256)`, `setDecreaseCoefficient(uint256)`.
- `withdrawETH(address)` — withdraws the entire native balance to `_to`.

The contract also has an empty `receive()` so it can accept native coin.

### `MeritCoin`

A standard 18-decimal ERC-20:

- Name: `Merit`
- Symbol: `MERIT`
- No initial supply is minted at deployment.
- `mint(address,uint256)` is restricted to the immutable `minter` (the CFG proxy).
- `burn(uint256)` burns the caller's own balance.

### `FortuneStick`

An ERC-721Enumerable:

- Name: `Fortune Stick`
- Symbol: `FS`
- `draw(address)` is restricted to the immutable `minter` (the CFG proxy).
- `tokenMinter[tokenId]` and `mintTime[tokenId]` are recorded at mint time.
- `setBaseURI(string)` is owner-only.
- There is no burn function.

## Architecture

```text
                    ┌──────────────────────────┐
                    │  ProxyAdmin (owner)      │
                    │  upgrade()               │
                    └────────────┬─────────────┘
                                 │ admin
                    ┌────────────▼─────────────┐
                    │  CFG: Transparent proxy  │
                    │  (stable address)        │
                    └────────────┬─────────────┘
                                 │ delegatecall
                    ┌────────────▼─────────────┐
                    │  CyberFortuneGod impl    │
                    └──────┬────────────┬──────┘
                           │ mint       │ draw
                    ┌──────▼──────┐ ┌───▼──────────┐
                    │  MeritCoin  │ │ FortuneStick │
                    │  ERC-20     │ │  ERC-721     │
                    └─────────────┘ └──────────────┘
```

`MeritCoin.minter` and `FortuneStick.minter` are immutable and point to the CFG proxy address. Upgrading the implementation does not change the proxy address, so minting permissions remain valid.

## Repository layout

```text
contracts/
  CyberFortuneGod.sol
  MeritCoin.sol
  FortuneStick.sol
  interface/
    IMeritCoin.sol
    IFortuneStick.sol
  lib/
    MyTransparentUpgradeableProxy.sol
    ProxyAdmin.sol
deploy/
  00_proxy_admin.js
  01_cyber_fortune_god.js
  02_merit_coin.js
  03_fortune_stick.js
args/
  cfg.js
  params.js
scripts/
  exportManifest.js
  upgrade.js
  set-params.js
  setBaseURI.js
  draw-e2e.js
  incense-e2e.js
test/
  CyberFortuneGod.js
deployments/
  bsc/
```

`contracts/lib/ProxyAdmin.sol` is a local copy of OpenZeppelin's `ProxyAdmin`.

## Getting started

Requirements:

- Node.js 18 or 20 (LTS)
- npm (the repository uses `package-lock.json`)

```bash
npm ci
npx hardhat compile
npx hardhat test
```

Run a local node and deploy:

```bash
# terminal 1
npx hardhat node

# terminal 2
npx hardhat deploy --network localhost
```

Or run a one-shot deployment on Hardhat's in-memory network:

```bash
npx hardhat deploy
```

The local defaults are defined in `args/cfg.js` (`startTime`, `decreaseCoefficient`, `totalSupplyByDay`, `mintPrice`). Local deployments do not require `PRIVATE_KEY`.

## Deployment

### Environment

Create `.env` from `.env.example` and set at least:

```bash
PRIVATE_KEY=...
BSC_RPC_URL=...          # optional; a public RPC is used by default
ETHERSCAN_API_KEY=...    # optional; for source verification
```

`PRIVATE_KEY` is the deployer. The deployer becomes the initial owner of `CyberFortuneGod`, `FortuneStick`, and `ProxyAdmin`.

The BSC mainnet config pins `gasPrice` to 1 gwei in `hardhat.config.js`; review it before deploying if network conditions have changed.

### Per-network parameters

Deployment parameters are isolated per network by a prefix. For a prefixed network, the deploy scripts read only `<PREFIX>_...` variables; unrelated global values are ignored.

| Network | Hardhat name | Chain ID | Prefix |
| --- | --- | --- | --- |
| BNB Smart Chain | `bsc` | 56 | `BSC_` |
| BSC Testnet | `bsc-test` | 97 | `BSC_TEST_` |
| Ethereum Sepolia | `sepolia` | 11155111 | `SEPOLIA_` |
| Arbitrum One | `arb` | 42161 | `ARB_` |
| Arbitrum Sepolia | `arb-test` | 421614 | `ARB_TEST_` |
| Robinhood Chain | `robinhood` | 4663 | `ROBINHOOD_` |
| Robinhood Chain Testnet | `robinhood-test` | 46630 | `ROBINHOOD_TEST_` |

Required variables for each deployment:

```bash
<PREFIX>_CFG_START_TIME=...
<PREFIX>_CFG_DECREASE_COEFFICIENT=...
<PREFIX>_CFG_TOTAL_SUPPLY_BY_DAY=...
<PREFIX>_CFG_MINT_PRICE=...
<PREFIX>_FORTUNE_STICK_BASE_URI=https://metadata.example.com
```

Optional:

```bash
<PREFIX>_FORTUNE_STICK_FINAL_BASE_URI=https://metadata.example.com/...
```

`FORTUNE_STICK_FINAL_BASE_URI` is the value actually written to `FortuneStick.baseURI`. If omitted, the deploy script derives:

```text
{BASE_URI}/api/v2/chains/{chainId}/nfts/{fortuneStickAddress}/metadata
```

That path is the convention used by the reference app. Set `FORTUNE_STICK_FINAL_BASE_URI` explicitly if your metadata service uses a different layout.

Numeric values are human-readable decimal amounts: `CFG_MINT_PRICE=0.002` means 0.002 native coin, not wei. `CFG_START_TIME` is a Unix timestamp in seconds.

### Deploy

```bash
npx hardhat deploy --network bsc-test
npx hardhat deploy --network bsc
```

The scripts deploy, in order:

1. `ProxyAdmin`
2. `CyberFortuneGod` implementation (`Impl`) and transparent proxy (`CFG`)
3. `MeritCoin`, bound to the CFG proxy
4. `FortuneStick`, bound to the CFG proxy

They fail fast on parameter mismatches and perform read-backs for the proxy admin, implementation, owner, minter, and base URI.

### Export a deployment manifest

```bash
CHAIN_EXPIRES_AT=2026-12-31T00:00:00Z \
  npm run export-manifest -- --network bsc
```

`CHAIN_EXPIRES_AT` is required for non-local networks. The manifest includes chain metadata, addresses, economic parameters, and ABI hashes. It is written to `deployments/<network>/manifest.json` and is not checked in.

## Upgrading `CyberFortuneGod`

Only `CyberFortuneGod` is upgradeable. `MeritCoin` and `FortuneStick` are immutable; their `minter` is the CFG proxy.

1. Build and deploy a new implementation.
2. Run the upgrade script with an explicit confirmation:

```bash
NEW_IMPL_ADDRESS=0x... \
EXPECTED_IMPL_ADDRESS=0x... \
CONFIRM_UPGRADE=true \
npx hardhat run scripts/upgrade.js --network bsc
```

Optional overrides: `CFG_PROXY_ADDRESS`, `PROXY_ADMIN_ADDRESS`. The script prints the current and target implementations and a storage-layout hash, then upgrades and reads back the new implementation.

The script does not prove storage compatibility. Review the storage layout manually before setting `CONFIRM_UPGRADE=true`.

To deploy a new implementation, `npx hardhat deploy --tags CyberFortuneGod` will deploy a new `Impl` when the bytecode has changed. Its proxy check then stops and prints the new implementation address; record that address as `NEW_IMPL_ADDRESS`. This stop is expected.

## Owner operations

`scripts/set-params.js` updates `mintPrice`:

```bash
SET_MINT_PRICE=0.002 npx hardhat run scripts/set-params.js --network bsc
```

`scripts/setBaseURI.js` updates `FortuneStick.baseURI`:

```bash
FORTUNE_STICK_FINAL_BASE_URI=https://metadata.example.com \
  npx hardhat run scripts/setBaseURI.js --network bsc
```

Both scripts verify that the signer is the owner, skip no-op writes, and read back the new value.

Other owner-only functions:

- `setTotalSupplyByDay(uint256)`
- `setDecreaseCoefficient(uint256)`
- `withdrawETH(address)`
- `initMeritCoin(address)` / `initFortuneStick(address)` — one-time, normally called by the deploy scripts.

`setTotalSupplyByDay` changes the cap used at the next daily reset; it does not resize the current day's remaining supply. `setMintPrice` and `setDecreaseCoefficient` affect subsequent calls.

The contracts do not validate these values. Setting `totalSupplyByDay` to `0` halts issuance at the next daily reset; setting `decreaseCoefficient` to `0` makes calls beyond the first four of a day revert.

## Source verification

The repository includes `@nomicfoundation/hardhat-verify` 2.1.x and uses the Etherscan V2 API. A single `ETHERSCAN_API_KEY` covers BSC and other Etherscan-family chains. Sourcify is temporarily disabled because the plugin's Sourcify integration still targets the removed v1 API. After deployment:

```bash
npx hardhat verify --network bsc <address> [constructor args...]
```

For the `CyberFortuneGod` implementation, the constructor arguments are the four initialization values (`startTime`, `decreaseCoefficient`, `totalSupplyByDay`, `mintPrice`). The proxy is verified separately with its own constructor arguments (`logic`, `admin`, `data`).

Always compare the on-chain implementation address with the address recorded in `deployments/<network>/` before interacting.

## Testing

```bash
npx hardhat test
```

The current suite covers:

- the `88 / 66 / 36 / 30` issuance sequence and the three-calls-per-address daily cap
- rejection of insufficient native payment
- zero initial `MERIT` supply
- the 8 `MERIT` draw flow, NFT minting, and original-drawer recording
- allowance, minter, and owner guards
- owner-only price and base URI changes

The suite does not include fuzzing, invariant testing, fork testing, or upgrade/storage-layout tests. It is not a substitute for an independent audit.

## Security

**These contracts have not been independently audited.**

Trust model and operational notes:

- **Upgrade rights.** `ProxyAdmin`'s owner can replace the `CyberFortuneGod` implementation. `CyberFortuneGod`'s owner can change `mintPrice`, `totalSupplyByDay`, and `decreaseCoefficient`, and can withdraw the contract's native balance. Treat these keys as trusted.
- **Ownership at deployment.** The deploy scripts leave ownership with the deployer address. For production, transfer ownership of `ProxyAdmin`, `CyberFortuneGod`, and `FortuneStick` to a multisig or timelock.
- **Excess payment.** `offeringIncense` accepts `msg.value >= mintPrice` and does not refund the difference. Send exactly `mintPrice`.
- **Off-chain metadata.** `tokenURI` depends on `baseURI`, which the `FortuneStick` owner can change. Metadata is not stored on-chain.
- **Stick number range.** `getStickNo` returns `1–60`.
- **Start time.** Before `startTime`, `getDays()` underflows and calls revert.
- **Minter bindings.** `MeritCoin` and `FortuneStick` have immutable minters pointing to the CFG proxy. A compromised or malicious CFG implementation can mint `MERIT` and NFTs.

To report a vulnerability, use GitHub Security Advisories for this repository. Do not open a public issue for an unfixed vulnerability.

## Integration notes

- The custom events (`OfferingIncense`, `DrawFortune`, `UpdateSupplyByDay`, and the owner events) declare no `indexed` parameters. Indexers must decode the `data` payload; the only topic is the event signature.
- `tokenMinter[tokenId]` is the original drawer, not the current owner. Use `ownerOf(tokenId)` for ownership.
- `getStickNo` works for any `tokenId` value, including unminted ones; only rely on it for minted tokens.
- `getDays()` and the issuance schedule use 24-hour windows from `startTime`, not UTC midnight.
- The contract has no pause function. The owner can halt new issuance by setting `totalSupplyByDay` to `0` at the next daily reset.

## License

MIT. See [LICENSE](LICENSE).

---

Built by [Sparkler Labs](https://sparklerlabs.com).

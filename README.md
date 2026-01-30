# Sofia Fee Proxy Dashboard

Real-time analytics dashboard for the **Sofia Fee Proxy** contract deployed on Intuition Mainnet (Chain ID 1155).

## Overview

The Sofia Fee Proxy sits between users and the Intuition MultiVault, collecting fees on `createTriples` and `deposit` operations before forwarding the remaining value. This dashboard visualizes all `TransactionForwarded` events emitted by the proxy to provide fee revenue metrics.

**Contract:** `0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`

## Features

- **Contract Overview** — Proxy address, fee recipient, MultiVault address, contract balance
- **Fee Configuration** — Current fixed fee and percentage fee settings
- **All-Time Summary** — Total fees collected, total volume, transaction counts by operation type
- **Cumulative Fee Chart** — SVG line chart showing fee accumulation over time (7d / 30d)
- **Period Metrics** — Transaction count, TRUST amount, and unique wallets for 7d / 30d / total
- **Recent Activity** — Table of the last 50 `TransactionForwarded` events with explorer links

## Fee Structure

| Operation | Fee |
|---|---|
| `createTriples` | Percentage-based fee on value sent |
| `deposit` | Fixed fee (0.1 TRUST) + percentage fee |
| `createAtoms` | No fee charged |

## Tech Stack

- **React + TypeScript** (Vite)
- **Tailwind CSS v4**
- **viem** — On-chain reads and event log fetching
- No external charting library (pure SVG)

## Getting Started

```bash
npm install
npm run dev
```

The dashboard connects directly to the Intuition Mainnet RPC (`https://rpc.intuition.systems`) — no wallet connection required.

## Configuration

Key constants in `src/config.ts`:

| Constant | Description |
|---|---|
| `SOFIA_PROXY_ADDRESS` | Proxy contract address |
| `DEPLOY_BLOCK` | Block to start scanning events from |
| `REFRESH_INTERVAL` | Auto-refresh interval (30s) |

## Data Source

All metrics are derived from on-chain `TransactionForwarded` events:

```
event TransactionForwarded(
  string operation,
  address indexed user,
  uint256 sofiaFee,
  uint256 multiVaultValue,
  uint256 totalReceived
)
```

Events are fetched in chunks of 50,000 blocks to avoid RPC limits. Timestamps are estimated from block numbers assuming ~1 block/sec on Intuition Mainnet.

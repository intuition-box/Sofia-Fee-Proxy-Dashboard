# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite production build (tsc -b && vite build)
npm run lint       # ESLint (flat config, ES2020 + browser)
npm run preview    # Preview production build locally
```

No test framework is configured.

## Architecture

React 19 + TypeScript + Vite + Tailwind CSS v4 dashboard for the **Sofia Fee Proxy** contract on Intuition Mainnet (chain ID 1155, RPC `https://rpc.intuition.systems`).

### Data flow

```
RpcQueue (serializes all HTTP, 429 backoff)
  └── rpcClient (viem PublicClient, single instance)
        ├── useContractState() → contract reads (fees, addresses, balance)
        └── useFeeData()
              ├── EventFetcher → getLogs in 50k-block chunks (TransactionForwarded)
              ├── BlockResolver → timestamp resolution for event blocks
              └── FeeAnalytics → pure computation (period stats, charts, totals)
```

### Service layer (`src/services/`)

- **RpcQueue** — Rate limiter wrapping `fetch`. Serializes requests with 500ms min delay, exponential backoff on 429 (2s base, 30s cap, 4 retries). All RPC traffic goes through this single queue.
- **rpcClient** — Singleton viem `PublicClient` using RpcQueue as custom `fetchFn`. viem retry is disabled.
- **EventFetcher** — Incremental `TransactionForwarded` event fetcher. First call scans `DEPLOY_BLOCK` (143120) → current in 50k-block chunks. Subsequent calls only scan new blocks. Caches events in memory.
- **BlockResolver** — Resolves block numbers to unix timestamps. Uses linear interpolation from 2 reference blocks (earliest event + latest chain block). Known limitation: accuracy degrades when block times are inconsistent.
- **FeeAnalytics** — Pure computation, no RPC. Takes `RawEvent[]`, produces `DashboardData` with period stats (7d/30d/total), chart points, all-time stats, recent transactions.

### Hooks (`src/hooks/`)

Both hooks are singletons (services instantiated outside the hook) and auto-refresh every 60s (`REFRESH_INTERVAL`). `useFeeData` guards against concurrent fetches via `fetchingRef`.

### Components (`src/components/`)

All presentational, props-driven, no internal state. `MetricCard` is the reusable building block. `FeeChart` renders pure SVG (no charting library). `FeeRevenue` manages period selection (7d/30d/total).

## Key Config (`src/config.ts`)

- `SOFIA_PROXY_ADDRESS`: `0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`
- `DEPLOY_BLOCK`: `143_120n`
- `REFRESH_INTERVAL`: `60_000` (60s)
- `EXPLORER_URL`: `https://explorer.intuition.systems`

## Conventions

- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- `UPPER_SNAKE_CASE` for constants, `camelCase` for functions, `PascalCase` for components
- All fees stored as `bigint` (wei), formatted via `formatTrust()` (`formatEther` + `toFixed(4)`)
- Dark theme only: background `#0a0a0f`, indigo accents, emerald for fees/success
- Tailwind v4 (via `@tailwindcss/vite` plugin), responsive grids with `lg:` breakpoints

## RPC Rate Limiting

The Intuition RPC is aggressively rate-limited. All HTTP requests **must** go through the shared `RpcQueue` (via `rpcClient` or the exported `rateLimitedFetch`). Never use raw `fetch()` against the RPC endpoint — it bypasses the queue, causes 429 cascades, and blocks legitimate viem calls.

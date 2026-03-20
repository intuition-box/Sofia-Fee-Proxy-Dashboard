import { defineChain } from "viem"

const RPC_KEY = import.meta.env.VITE_RPC_KEY
const RPC_URL = `https://vib.rpc.intuition.box/http/${RPC_KEY}`

export const intuitionMainnet = defineChain({
  id: 1155,
  name: "Intuition Mainnet",
  network: "intuition-mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Trust",
    symbol: "TRUST",
  },
  rpcUrls: {
    public: { http: [RPC_URL] },
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: "https://explorer.intuition.systems",
    },
  },
})

export const SOFIA_PROXY_ADDRESS =
  "0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c" as const

export const EXPLORER_URL = "https://explorer.intuition.systems"
export const EXPLORER_API_URL = "https://explorer.intuition.systems/api"

export const REFRESH_INTERVAL = 60_000 // 60s auto-refresh

// Block at which the SofiaFeeProxy was deployed (tx 0x185251…)
export const DEPLOY_BLOCK = 143_120n

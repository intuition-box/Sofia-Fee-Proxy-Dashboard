import { createPublicClient, http } from "viem"
import { intuitionMainnet } from "../config"
import { RpcQueue } from "./RpcQueue"

/**
 * Singleton RPC queue — shared across every service.
 * Handles concurrency limiting + exponential backoff on 429.
 */
const rpcQueue = new RpcQueue()

/**
 * Application-wide viem client.
 *
 * `fetchFn` is routed through RpcQueue which serializes requests,
 * auto-retries on 429 / network errors with exponential backoff,
 * and enforces minimum delay between dispatches.
 * viem retry is disabled — the queue is the single retry authority.
 */
export const rpcClient = createPublicClient({
  chain: intuitionMainnet,
  transport: http(undefined, {
    retryCount: 0,
    fetchFn: rpcQueue.createFetchFn(),
  }),
})

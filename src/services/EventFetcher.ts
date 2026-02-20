import { parseAbiItem } from "viem"
import { rpcClient } from "./rpcClient"
import { BlockResolver } from "./BlockResolver"
import { SOFIA_PROXY_ADDRESS, DEPLOY_BLOCK } from "../config"

const TX_FORWARDED_EVENT = parseAbiItem(
  "event TransactionForwarded(string operation, address indexed user, uint256 sofiaFee, uint256 multiVaultValue, uint256 totalReceived)"
)

const BLOCK_CHUNK = 50_000n

export interface RawEvent {
  operation: string
  user: string
  sofiaFee: bigint
  multiVaultValue: bigint
  totalReceived: bigint
  blockNumber: bigint
  txHash: string
  timestamp: number // 0 until resolved, then real on-chain timestamp
}

/**
 * Fetches TransactionForwarded events incrementally.
 * On first call: scans from DEPLOY_BLOCK to current.
 * On subsequent calls: only fetches new blocks since last scan.
 *
 * Timestamps are resolved separately via resolveTimestamps() to enable
 * progressive rendering (show totals immediately, period stats later).
 */
export class EventFetcher {
  private events: RawEvent[] = []
  private lastScannedBlock: bigint = DEPLOY_BLOCK
  private blockResolver: BlockResolver

  constructor(blockResolver: BlockResolver) {
    this.blockResolver = blockResolver
  }

  /**
   * Fetch all events (incremental on subsequent calls).
   * Returns events with timestamp=0 for new entries — call resolveTimestamps()
   * separately to fill in real timestamps.
   */
  async fetch(): Promise<RawEvent[]> {
    const currentBlock = await rpcClient.getBlockNumber()

    if (currentBlock <= this.lastScannedBlock && this.events.length > 0) {
      return this.events
    }

    const fromBlock =
      this.events.length > 0 ? this.lastScannedBlock + 1n : DEPLOY_BLOCK

    const newLogs = await this.getLogsInChunks(fromBlock, currentBlock)

    if (newLogs.length > 0) {
      const newEvents: RawEvent[] = newLogs.map((log) => ({
        operation: log.args.operation ?? "unknown",
        user: log.args.user ?? "0x",
        sofiaFee: log.args.sofiaFee ?? 0n,
        multiVaultValue: log.args.multiVaultValue ?? 0n,
        totalReceived: log.args.totalReceived ?? 0n,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        timestamp: 0, // Resolved later via resolveTimestamps()
      }))

      this.events.push(...newEvents)
      this.events.sort((a, b) => Number(a.blockNumber - b.blockNumber))
    }

    this.lastScannedBlock = currentBlock
    return this.events
  }

  /**
   * Resolve timestamps for events that don't have them yet.
   * Returns the updated events array, or null if nothing changed.
   */
  async resolveTimestamps(): Promise<RawEvent[] | null> {
    const unresolved = this.events.filter((e) => e.timestamp === 0)
    if (unresolved.length === 0) return null

    const blockNumbers = unresolved.map((e) => e.blockNumber)
    const timestamps = await this.blockResolver.resolveBlocks(blockNumbers)

    let updated = false
    for (const event of this.events) {
      if (event.timestamp === 0) {
        const ts = timestamps.get(event.blockNumber) ?? 0
        if (ts > 0) {
          event.timestamp = ts
          updated = true
        }
      }
    }

    return updated ? this.events : null
  }

  private async getLogsInChunks(
    fromBlock: bigint,
    toBlock: bigint
  ) {
    const allLogs: Awaited<ReturnType<typeof rpcClient.getLogs<typeof TX_FORWARDED_EVENT>>>  = []
    let cursor = fromBlock

    while (cursor <= toBlock) {
      const end =
        cursor + BLOCK_CHUNK - 1n > toBlock
          ? toBlock
          : cursor + BLOCK_CHUNK - 1n

      const logs = await rpcClient.getLogs({
        address: SOFIA_PROXY_ADDRESS,
        event: TX_FORWARDED_EVENT,
        fromBlock: cursor,
        toBlock: end,
      })

      allLogs.push(...logs)
      cursor = end + 1n
    }

    return allLogs
  }

  get cachedEventCount(): number {
    return this.events.length
  }
}

import { rpcClient } from "./rpcClient"

/**
 * Resolves block numbers to timestamps using linear interpolation.
 * Only fetches 2 reference blocks (earliest + latest) → 2 RPC calls total.
 * Accurate as long as block time is roughly consistent.
 */
export class BlockResolver {
  private refEarlyBlock: bigint | null = null
  private refEarlyTimestamp: number | null = null
  private refLatestBlock: bigint | null = null
  private refLatestTimestamp: number | null = null
  private secPerBlock = 1

  /**
   * Calibrate the resolver with the earliest event block and latest chain block.
   * Must be called once before resolveMany.
   */
  async calibrate(earliestBlock: bigint, latestBlock: bigint): Promise<void> {
    // Only fetch if not already calibrated or if latest block changed significantly
    if (
      this.refLatestBlock !== null &&
      latestBlock - this.refLatestBlock < 1000n
    ) {
      return
    }

    const [early, latest] = await Promise.all([
      this.refEarlyBlock === earliestBlock && this.refEarlyTimestamp !== null
        ? { timestamp: BigInt(this.refEarlyTimestamp) }
        : rpcClient.getBlock({ blockNumber: earliestBlock }),
      rpcClient.getBlock({ blockNumber: latestBlock }),
    ])

    this.refEarlyBlock = earliestBlock
    this.refEarlyTimestamp = Number(early.timestamp)
    this.refLatestBlock = latestBlock
    this.refLatestTimestamp = Number(latest.timestamp)

    const blockSpan = Number(latestBlock - earliestBlock)
    const timeSpan = this.refLatestTimestamp - this.refEarlyTimestamp
    this.secPerBlock = blockSpan > 0 ? timeSpan / blockSpan : 1
  }

  /** Interpolate a timestamp for a given block number. */
  resolve(blockNumber: bigint): number {
    if (this.refLatestBlock === null || this.refLatestTimestamp === null) {
      throw new Error("BlockResolver not calibrated. Call calibrate() first.")
    }
    const blockDiff = Number(this.refLatestBlock - blockNumber)
    return Math.round(this.refLatestTimestamp - blockDiff * this.secPerBlock)
  }

  /** Resolve many block numbers at once (no RPC calls, pure math). */
  resolveMany(blockNumbers: bigint[]): Map<bigint, number> {
    const result = new Map<bigint, number>()
    for (const bn of blockNumbers) {
      result.set(bn, this.resolve(bn))
    }
    return result
  }

  get calibrated(): boolean {
    return this.refLatestBlock !== null
  }
}

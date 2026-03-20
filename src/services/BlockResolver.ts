import { rpcClient } from "./rpcClient"

/** localStorage key — bump version suffix to invalidate stale caches. */
const CACHE_KEY = "sofia-block-timestamps-v2"

// ── Cache helpers ──────────────────────────────────────────────────────────

type CacheEntry = [string, number] // [blockNumberDecimalString, unixTimestamp]

function loadCache(): Map<bigint, number> {
  const cache = new Map<bigint, number>()
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return cache
    const entries = JSON.parse(raw) as CacheEntry[]
    if (!Array.isArray(entries)) return cache
    for (const [blockStr, ts] of entries) {
      if (typeof blockStr === "string" && typeof ts === "number" && ts > 0) {
        cache.set(BigInt(blockStr), ts)
      }
    }
  } catch {
    console.warn("[BlockResolver] Failed to load cache, starting fresh.")
  }
  return cache
}

function saveCache(cache: Map<bigint, number>): void {
  try {
    const entries: CacheEntry[] = []
    for (const [bn, ts] of cache) {
      if (ts > 0) entries.push([bn.toString(), ts])
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries))
  } catch {
    console.warn("[BlockResolver] Failed to persist cache to localStorage.")
  }
}

// ── Main class ─────────────────────────────────────────────────────────────

/**
 * Resolves block numbers to real on-chain timestamps via the private RPC
 * (eth_getBlockByNumber). All requests go through the private node in parallel.
 *
 * Results are persisted in localStorage so subsequent page loads need zero RPC calls.
 */
export class BlockResolver {
  private cache: Map<bigint, number> = loadCache()

  /**
   * Resolve an array of block numbers to their real timestamps.
   * Fetches all uncached blocks in parallel via the RPC.
   */
  async resolveBlocks(blockNumbers: bigint[]): Promise<Map<bigint, number>> {
    if (blockNumbers.length === 0) return new Map()

    // Deduplicate
    const seen = new Set<string>()
    const unique: bigint[] = []
    for (const bn of blockNumbers) {
      const key = bn.toString()
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(bn)
      }
    }

    // Find uncached
    const uncached = unique.filter((bn) => !this.cache.has(bn))

    if (uncached.length > 0) {
      console.log(
        `[BlockResolver] Fetching ${uncached.length} block timestamps via RPC ` +
          `(${unique.length - uncached.length} cached)`,
      )

      // Fetch all uncached blocks in parallel
      const results = await Promise.all(
        uncached.map(async (bn) => {
          try {
            const block = await rpcClient.getBlock({ blockNumber: bn })
            return { bn, ts: Number(block.timestamp) }
          } catch (err) {
            console.warn(`[BlockResolver] Failed to fetch block ${bn}: ${String(err)}`)
            return { bn, ts: 0 }
          }
        })
      )

      for (const { bn, ts } of results) {
        if (ts > 0) {
          this.cache.set(bn, ts)
        }
      }

      saveCache(this.cache)
    }

    // Build result map
    const result = new Map<bigint, number>()
    for (const bn of blockNumbers) {
      result.set(bn, this.cache.get(bn) ?? 0)
    }
    return result
  }

  /** Number of block timestamps currently held in cache. */
  get cacheSize(): number {
    return this.cache.size
  }
}

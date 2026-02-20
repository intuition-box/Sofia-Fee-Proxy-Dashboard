import {
  EXPLORER_API_URL,
  SOFIA_PROXY_ADDRESS,
  DEPLOY_BLOCK,
} from "../config"

// ── Configuration ──────────────────────────────────────────────────────────

/** If more than this many blocks are uncached, use bulk getLogs fetch. */
const BULK_THRESHOLD = 20

/** Max pages to fetch during bulk getLogs (safety against infinite loops). */
const MAX_PAGES = 200

/** Number of concurrent Blockscout API requests for individual block fetch. */
const CONCURRENCY = 5

/** Minimum milliseconds between consecutive individual-fetch batches. */
const BATCH_DELAY_MS = 500

/** Initial backoff (ms) after a rate-limit or network error. */
const RETRY_BASE_MS = 2_000

/** Maximum backoff cap (ms). */
const RETRY_MAX_MS = 60_000

/** Exponential multiplier applied on each consecutive error. */
const RETRY_MULTIPLIER = 2

/** Max retry attempts before giving up. */
const MAX_RETRIES = 5

/** localStorage key — bump version suffix to invalidate stale caches. */
const CACHE_KEY = "sofia-block-timestamps-v1"

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
 * Resolves block numbers to real on-chain timestamps via the Blockscout
 * REST API (separate from the JSON-RPC endpoint, different rate limits).
 *
 * Two strategies:
 *  - Bulk: paginate contract logs via getLogs (includes timestamps) — fast for cold start
 *  - Individual: per-block getblockreward — fast for 1-20 new blocks on refresh
 *
 * Results are persisted in localStorage so subsequent page loads need zero API calls.
 */
export class BlockResolver {
  private cache: Map<bigint, number> = loadCache()
  private lastBatchTime = 0

  /**
   * Resolve an array of block numbers to their real timestamps.
   * Uses bulk getLogs for large uncached sets, individual fetch for small ones.
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

    // Partition into cached vs uncached
    const uncached = unique.filter((bn) => !this.cache.has(bn))

    if (uncached.length > BULK_THRESHOLD) {
      // Many uncached blocks → bulk fetch via getLogs (fast, ~30 pages)
      console.log(
        `[BlockResolver] Bulk fetching timestamps via getLogs ` +
          `(${uncached.length} uncached, ${unique.length - uncached.length} cached)`,
      )
      await this.bulkFetchViaLogs()

      // Fallback: any blocks still missing after bulk (edge case)
      const stillUncached = unique.filter((bn) => !this.cache.has(bn))
      if (stillUncached.length > 0) {
        console.log(
          `[BlockResolver] ${stillUncached.length} blocks not found in logs, fetching individually`,
        )
        await this.fetchIndividually(stillUncached)
      }
    } else if (uncached.length > 0) {
      // Few uncached blocks → individual fetch (faster for small sets)
      console.log(
        `[BlockResolver] Fetching ${uncached.length} block timestamps individually ` +
          `(${unique.length - uncached.length} cached)`,
      )
      await this.fetchIndividually(uncached)
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

  // ── Bulk fetch via Blockscout getLogs ─────────────────────────────────────

  private async bulkFetchViaLogs(): Promise<void> {
    let page = 1
    let totalFetched = 0

    while (page <= MAX_PAGES) {
      const url =
        `${EXPLORER_API_URL}?module=logs&action=getLogs` +
        `&fromBlock=${DEPLOY_BLOCK}` +
        `&toBlock=99999999` +
        `&address=${SOFIA_PROXY_ADDRESS}` +
        `&page=${page}&offset=1000`

      let data: { status: string; result: Array<{ blockNumber: string; timeStamp: string }> }
      try {
        const response = await fetch(url)
        if (response.status === 429) {
          console.warn(`[BlockResolver] Bulk fetch rate limited on page ${page}, retrying...`)
          await this.sleep(RETRY_BASE_MS)
          continue // Retry same page
        }
        if (!response.ok) {
          console.warn(`[BlockResolver] Bulk fetch HTTP ${response.status} on page ${page}, stopping`)
          break
        }
        data = await response.json()
      } catch (err) {
        console.warn(`[BlockResolver] Bulk fetch network error on page ${page}: ${String(err)}`)
        break
      }

      // Stop if no results or API signals failure
      if (data.status !== "1" || !Array.isArray(data.result) || data.result.length === 0) {
        break
      }

      // Extract blockNumber → timestamp from each log entry
      for (const log of data.result) {
        try {
          const blockNum = BigInt(log.blockNumber)
          const timestamp = Number(log.timeStamp.startsWith("0x")
            ? parseInt(log.timeStamp, 16)
            : log.timeStamp)

          if (timestamp > 0) {
            this.cache.set(blockNum, timestamp)
          }
        } catch {
          // Skip malformed entries
        }
      }

      totalFetched += data.result.length
      page++

      // If we got fewer results than a full page, we've reached the end
      if (data.result.length < 100) {
        break
      }
    }

    console.log(
      `[BlockResolver] Bulk fetch complete: ${totalFetched} logs processed ` +
        `in ${page - 1} pages, ${this.cache.size} unique blocks cached`,
    )
    saveCache(this.cache)
  }

  // ── Individual fetch via getblockreward ──────────────────────────────────

  private async fetchIndividually(blockNumbers: bigint[]): Promise<void> {
    const sorted = [...blockNumbers].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )

    for (let i = 0; i < sorted.length; i += CONCURRENCY) {
      const batch = sorted.slice(i, i + CONCURRENCY)

      await this.enforceDelay()
      this.lastBatchTime = Date.now()

      await Promise.all(batch.map((bn) => this.fetchOneWithRetry(bn)))
      saveCache(this.cache)
    }
  }

  private async fetchOneWithRetry(blockNumber: bigint): Promise<void> {
    let backoffMs = RETRY_BASE_MS

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const ts = await this.fetchBlockTimestamp(blockNumber)
        if (ts > 0) {
          this.cache.set(blockNumber, ts)
        }
        return
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          console.error(
            `[BlockResolver] Failed to fetch block ${blockNumber} after ` +
              `${MAX_RETRIES} retries: ${String(err)}`,
          )
          return // Leave uncached — will retry on next page load
        }

        const jitter = backoffMs * (0.8 + Math.random() * 0.4)
        console.warn(
          `[BlockResolver] Error fetching block ${blockNumber} ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES}). ` +
            `Retrying in ${Math.round(jitter)}ms`,
        )
        await this.sleep(jitter)
        backoffMs = Math.min(backoffMs * RETRY_MULTIPLIER, RETRY_MAX_MS)
      }
    }
  }

  private async fetchBlockTimestamp(blockNumber: bigint): Promise<number> {
    const url =
      `${EXPLORER_API_URL}?module=block&action=getblockreward` +
      `&blockno=${blockNumber}`

    const response = await fetch(url)

    if (response.status === 429) {
      throw new Error("429: Rate limited by Blockscout API")
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Blockscout API`)
    }

    const data = await response.json()

    if (data.status !== "1" || !data.result?.timeStamp) {
      throw new Error(
        `Unexpected response for block ${blockNumber}: ${JSON.stringify(data)}`,
      )
    }

    const ts = Number(data.result.timeStamp)
    if (isNaN(ts) || ts <= 0) {
      throw new Error(
        `Invalid timestamp for block ${blockNumber}: ${data.result.timeStamp}`,
      )
    }

    return ts
  }

  // ── Timing helpers ───────────────────────────────────────────────────────

  private async enforceDelay(): Promise<void> {
    const elapsed = Date.now() - this.lastBatchTime
    if (elapsed < BATCH_DELAY_MS) {
      await this.sleep(BATCH_DELAY_MS - elapsed)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}

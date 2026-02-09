/**
 * Rate-limited request queue with exponential backoff on HTTP 429.
 *
 * Responsibilities:
 *  - Serialize HTTP requests (one at a time) to avoid flooding the RPC.
 *  - Enforce a minimum delay between consecutive dispatches.
 *  - Detect 429 responses and retry automatically with exponential
 *    backoff + jitter — callers never see a 429 unless maxRetries
 *    is exhausted.
 *  - Catch network errors and retry with the same backoff strategy.
 */

export interface RpcQueueConfig {
  /** Min delay (ms) enforced between two consecutive dispatches */
  minDelayMs: number
  /** Initial backoff (ms) after the first 429 */
  baseBackoffMs: number
  /** Maximum backoff cap (ms) */
  maxBackoffMs: number
  /** Multiplier applied on each consecutive 429 */
  backoffMultiplier: number
  /** Max automatic retries on 429 / network error before giving up */
  maxRetries: number
}

const DEFAULT_CONFIG: RpcQueueConfig = {
  minDelayMs: 500,
  baseBackoffMs: 2_000,
  maxBackoffMs: 30_000,
  backoffMultiplier: 2,
  maxRetries: 4,
}

interface PendingEntry {
  execute: () => void
}

export class RpcQueue {
  private readonly config: RpcQueueConfig
  private busy = false
  private readonly pending: PendingEntry[] = []
  private lastDispatchTime = 0
  private backoffUntil = 0
  private consecutiveRateLimits = 0

  constructor(config?: Partial<RpcQueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Returns a drop-in `fetch` replacement that routes every request
   * through this queue.  Pass it as `fetchFn` to viem's http transport.
   */
  createFetchFn(): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit) =>
      this.enqueue(() => fetch(input, init))
  }

  /** Whether a request is currently in-flight. */
  get active(): boolean {
    return this.busy
  }

  /** Number of requests waiting in the queue. */
  get queued(): number {
    return this.pending.length
  }

  // ── Internals ───────────────────────────────────────────────

  private enqueue(fn: () => Promise<Response>): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.pending.push({
        execute: () => this.dispatch(fn).then(resolve, reject),
      })
      this.flush()
    })
  }

  /** Start the next pending request if the slot is free. */
  private flush(): void {
    if (this.pending.length > 0 && !this.busy) {
      const entry = this.pending.shift()!
      entry.execute()
    }
  }

  /**
   * Execute one request with retry, backoff and min-delay awareness.
   * Holds the single slot for the entire retry cycle so no other
   * request can fire while the RPC is rate-limiting us.
   */
  private async dispatch(fn: () => Promise<Response>): Promise<Response> {
    this.busy = true
    try {
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        await this.waitForBackoff()
        await this.enforceMinDelay()
        this.lastDispatchTime = Date.now()

        let response: Response
        try {
          response = await fn()
        } catch (err) {
          // Network error — apply backoff and retry
          if (attempt === this.config.maxRetries) throw err
          this.applyBackoff()
          continue
        }

        if (response.status !== 429) {
          this.consecutiveRateLimits = 0
          return response
        }

        // 429 — apply backoff and retry (or give up on last attempt)
        this.applyBackoff()
        if (attempt === this.config.maxRetries) {
          return response
        }
      }

      // TypeScript: unreachable
      throw new Error("[RpcQueue] Unexpected exit from retry loop")
    } finally {
      this.busy = false
      this.flush()
    }
  }

  /** Block until the global backoff window expires. */
  private async waitForBackoff(): Promise<void> {
    const remaining = this.backoffUntil - Date.now()
    if (remaining > 0) {
      await this.sleep(remaining)
    }
  }

  /** Block until `minDelayMs` has passed since the previous dispatch. */
  private async enforceMinDelay(): Promise<void> {
    const elapsed = Date.now() - this.lastDispatchTime
    if (elapsed < this.config.minDelayMs) {
      await this.sleep(this.config.minDelayMs - elapsed)
    }
  }

  /** Calculate and set the next backoff window after a 429. */
  private applyBackoff(): void {
    this.consecutiveRateLimits++
    const base =
      this.config.baseBackoffMs *
      Math.pow(
        this.config.backoffMultiplier,
        this.consecutiveRateLimits - 1,
      )
    const capped = Math.min(base, this.config.maxBackoffMs)
    // Add ±20 % jitter to avoid thundering-herd on recovery
    const jitter = capped * (0.8 + Math.random() * 0.4)
    this.backoffUntil = Date.now() + jitter

    console.warn(
      `[RpcQueue] 429 detected (×${this.consecutiveRateLimits}). ` +
        `Backoff: ${Math.round(jitter)}ms`,
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
